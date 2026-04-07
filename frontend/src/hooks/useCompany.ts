import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

export function useCompany() {
  return useQuery({
    queryKey: ['my-company'],
    queryFn: () =>
      apiFetch<{ status: string; data: any }>('/api/companies/my-company')
        .then((r) => r.data)
        .catch(() => null), // User may not have a company
  });
}

export function useAllCompanies() {
  return useQuery({
    queryKey: ['companies'],
    queryFn: () =>
      apiFetch<{ status: string; data: any[] }>('/api/companies')
        .then((r) => r.data),
  });
}

export function useCompanyStats(page = 1, limit = 20, search = '') {
  return useQuery({
    queryKey: ['company-stats', page, limit, search],
    queryFn: () =>
      apiFetch<{ status: string; data: any[]; pagination?: any }>(`/api/companies/stats?page=${page}&limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ''}`)
        .then((r) => r),
  });
}
