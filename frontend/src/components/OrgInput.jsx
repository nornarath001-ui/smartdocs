import { useEffect, useState } from 'react';
import api from '../api/axios';
import { useLang } from '../context/LangContext';

// Free text with suggestions from organizations already used
export default function OrgInput({ value, onChange, disabled }) {
  const { t } = useLang();
  const [list, setList] = useState([]);

  useEffect(() => {
    api.get('/public/filters').then((r) => setList(r.data.organizations.map((o) => o.name))).catch(() => {});
  }, []);

  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{t('organization')}</label>
      <input className="input" list="org-list" value={value || ''} maxLength={150} disabled={disabled}
        placeholder={t('organizationHint')} onChange={(e) => onChange(e.target.value)} />
      <datalist id="org-list">{list.map((o) => <option key={o} value={o} />)}</datalist>
    </div>
  );
}
