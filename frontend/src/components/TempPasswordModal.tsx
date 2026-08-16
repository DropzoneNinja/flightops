import { useState } from 'react';

interface TempPasswordModalProps {
  username: string;
  tempPassword: string;
  onClose: () => void;
}

export function TempPasswordModal({ username, tempPassword, onClose }: TempPasswordModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — the password is still select-all-able below.
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[#141d2b] border border-[#2a3a54] rounded-lg max-w-md w-full p-6 space-y-4">
        <h3 className="text-lg font-semibold text-white">Temporary Password Set</h3>
        <p className="text-sm text-[#a0b3cc]">
          <span className="font-medium text-white">{username}</span> will be required to set a
          new password on next login. There is no automatic email — share this temporary
          password with them directly. It will not be shown again.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-[#0d1421] border border-[#2a3a54] rounded-md px-3 py-2 text-white font-mono text-sm select-all">
            {tempPassword}
          </code>
          <button
            onClick={handleCopy}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#2a3a54] hover:bg-[#354a6b] text-white rounded-md text-sm font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
