import { Navigate, useSearchParams } from 'react-router-dom';
import { useEvalStore } from '@/store/eval.store';

const GATE_CHAPTERS = new Set(['checks', 'split', 'power', 'profile']);

/** Old Data Lab URL → Golden Sets · Gate. */
export function DataLabPage() {
  const datasetId = useEvalStore((s) => s.datasetId);
  const [params] = useSearchParams();
  const tab = params.get('tab');
  const chapter = tab && GATE_CHAPTERS.has(tab) ? tab : 'checks';
  if (!datasetId) return <Navigate to="/evaluation/dataset" replace />;
  return (
    <Navigate
      to={`/evaluation/dataset/${encodeURIComponent(datasetId)}?tab=gate&sub=${chapter}`}
      replace
    />
  );
}
