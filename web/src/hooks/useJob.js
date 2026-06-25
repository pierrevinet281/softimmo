import { useQuery } from '@tanstack/react-query';
import api from '../api/client.js';

// Poll a job until it reaches a terminal state.
export function useJob(jobId, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['job', jobId],
    queryFn: () => api.get(`/jobs/${jobId}`),
    enabled: enabled && !!jobId,
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s && ['done', 'error', 'canceled'].includes(s) ? false : 1200;
    },
  });
}

export function useJobItems(jobId, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['job-items', jobId],
    queryFn: () => api.get(`/jobs/${jobId}/items`),
    enabled: enabled && !!jobId,
    refetchInterval: 1500,
  });
}

export default useJob;
