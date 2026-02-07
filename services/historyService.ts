import { supabase } from './supabase';
import { HistoryItem, UserProfile } from '../types';

// Helper para extrair data do nome do arquivo (dd-mm-yyyy ou dd_mm_yyyy)
const extractDateFromFileName = (fileName: string): string | null => {
  const match = fileName.match(/(\d{2})[-_](\d{2})[-_](\d{4})/);
  if (match) {
    const [_, d, m, y] = match;
    return `${y}-${m}-${d}`; // Formato ISO YYYY-MM-DD
  }
  return null;
};

// Busca apenas metadados leves para a barra lateral e listagens
export const fetchHistory = async (profile: UserProfile): Promise<HistoryItem[]> => {
  try {
    let query = supabase
      .from('audit_history')
      .select('id, created_at, file_name, report_type, stats, custom_date, loja')
      .order('created_at', { ascending: false })
      .limit(500);

    if (profile.role !== 'admin') {
      query = query.eq('loja', profile.loja);
    } else if (profile.visibleLojas && profile.visibleLojas.length > 0) {
      query = query.in('loja', profile.visibleLojas);
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data || []).map((row: any) => ({
      id: row.id,
      timestamp: new Date(row.created_at).getTime(),
      fileName: row.file_name,
      reportType: row.report_type,
      data: [],
      classDetails: [],
      categoryStats: null,
      collaboratorStats: null,
      stats: row.stats || { totalSku: 0, totalNotRead: 0, generalPartial: 0 },
      customDate: row.custom_date,
      loja: row.loja || '204'
    }));
  } catch (error: any) {
    console.error('Error fetching history:', error);
    throw error;
  }
};

// Busca os dados pesados (JSONB) de um único relatório
export const fetchHistoryItemDetails = async (id: string): Promise<any> => {
  try {
    const { data, error } = await supabase
      .from('audit_history')
      .select('data, class_details, category_stats, collaborator_stats')
      .eq('id', id)
      .single();

    if (error) throw error;

    return {
      data: data.data || [],
      classDetails: data.class_details || [],
      categoryStats: data.category_stats || null,
      collaboratorStats: data.collaborator_stats || null
    };
  } catch (error: any) {
    console.error('Error fetching item details:', error);
    throw error;
  }
};

const REPORT_LIMITS: Record<string, number> = {
  'audit': 5,
  'analysis': 1,
  'class': 1,
  'final_rupture': 1
};

// Função auxiliar para obter o intervalo da semana (Domingo a Sábado)
const getWeekRange = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay(); // 0 (Dom) a 6 (Sab)

  const diffToSunday = day;
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - diffToSunday);
  sunday.setHours(0, 0, 0, 0);

  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);
  saturday.setHours(23, 59, 59, 999);

  return { sunday, saturday };
};

export const addHistoryItem = async (item: HistoryItem): Promise<void> => {
  const loja = item.loja || '204';
  const type = item.reportType;
  const limit = REPORT_LIMITS[type] || 5;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    if (type === 'rupture' || type === 'final_rupture') {
      const itemDate = item.customDate ? new Date(item.customDate + 'T12:00:00') : new Date(item.timestamp);
      const { sunday, saturday } = getWeekRange(itemDate);

      const { data: existingInWeek } = await supabase
        .from('audit_history')
        .select('id')
        .eq('loja', loja)
        .eq('report_type', 'rupture')
        .gte('created_at', sunday.toISOString())
        .lte('created_at', saturday.toISOString());

      if (existingInWeek && existingInWeek.length > 0) {
        const idsToDelete = existingInWeek.map(r => r.id);
        await supabase.from('audit_history').delete().in('id', idsToDelete);
      }
    } else {
      let query = supabase
        .from('audit_history')
        .select('id')
        .eq('loja', loja)
        .eq('report_type', type);

      if (item.customDate) {
        query = query.eq('custom_date', item.customDate);
      } else {
        query = query.is('custom_date', null);
      }

      const { data: existing } = await query.order('created_at', { ascending: true });

      if (existing && existing.length >= limit) {
        const toDeleteCount = (existing.length - limit) + 1;
        const idsToDelete = existing.slice(0, toDeleteCount).map(r => r.id);
        await supabase.from('audit_history').delete().in('id', idsToDelete);
      }
    }

    // --- GARANTIA DE DATA (ROBUSTEZ) ---
    let finalCustomDate = item.customDate;

    if (!finalCustomDate) {
      // Tenta extrair do nome do arquivo
      finalCustomDate = extractDateFromFileName(item.fileName);

      // Se ainda não tiver, usa a data atual do sistema como fallback fixo
      if (!finalCustomDate) {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        finalCustomDate = `${y}-${m}-${d}`;
        console.log(`📅 Data auto-atribuída para ${item.fileName}: ${finalCustomDate} (Atual)`);
      } else {
        console.log(`📅 Data extraída do arquivo ${item.fileName}: ${finalCustomDate}`);
      }
    }

    const payload = {
      file_name: item.fileName,
      report_type: item.reportType,
      custom_date: finalCustomDate,
      stats: item.stats,
      data: item.data || [],
      class_details: item.classDetails || [],
      category_stats: item.categoryStats || null,
      collaborator_stats: item.collaboratorStats || null,
      loja: loja,
      user_id: user.id
    };

    const { error } = await supabase.from('audit_history').insert(payload);
    if (error) throw error;
  } catch (error: any) {
    console.error('Error adding history item:', error);
    throw error;
  }
};

export const updateHistoryItemDate = async (id: string, newDate: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('audit_history')
      .update({ custom_date: newDate })
      .eq('id', id);
    if (error) throw error;
  } catch (error) {
    console.error('Error updating history item date:', error);
    throw error;
  }
};

export const deleteHistoryItemById = async (id: string): Promise<void> => {
  try {
    const { error } = await supabase.from('audit_history').delete().eq('id', id);
    if (error) throw error;
  } catch (error) {
    console.error('Error deleting item:', error);
    throw error;
  }
};

export const deleteAllHistory = async (): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase.from('audit_history').delete().eq('user_id', user.id);
    if (error) throw error;
  } catch (error) {
    console.error('Error deleting all history:', error);
    throw error;
  }
};
