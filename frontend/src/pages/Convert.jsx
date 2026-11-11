import { useSearchParams } from 'react-router-dom';
import PublicLayout from '../components/PublicLayout';
import ConverterPanel from '../components/ConverterPanel';

export default function Convert() {
  const [params] = useSearchParams();
  return (
    <PublicLayout>
      <div className="mx-auto max-w-3xl">
        <ConverterPanel initialMode={params.get('mode') || 'word-pdf'} />
      </div>
    </PublicLayout>
  );
}
