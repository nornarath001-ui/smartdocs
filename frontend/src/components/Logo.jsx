import { useState } from 'react';

export default function Logo({ size = 36, className = '' }) {
  const [failed, setFailed] = useState(false);
  const box = { width: size, height: size };
  if (failed) {
    return (
      <span style={box} className={`flex shrink-0 items-center justify-center rounded-lg bg-indigo-600 font-bold text-white ${className}`}>S</span>
    );
  }
  return <img src="/images/organ.png" alt="Logo" style={box} onError={() => setFailed(true)}
    className={`shrink-0 rounded-lg object-contain ${className}`} />;
}
