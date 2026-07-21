import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Image as ImageIcon, Loader2, X, AlertCircle } from 'lucide-react';

/**
 * Reusable image upload widget — used by MemberForm and BeneficiaryForm.
 *
 * Props:
 *   - label: string
 *   - fieldName: 'photo' | 'cnicFront' | 'cnicBack'
 *   - currentUrl: string | null
 *   - uploader: (fieldName, file, onProgress) => Promise<{ photoUrl?, cnicFrontUrl?, cnicBackUrl? }>
 *   - onUploaded(url|null): called with final URL (or null on remove)
 *   - onError(msg): called on upload failure
 */
export function ImageUploadField({ label, fieldName, currentUrl, uploader, onUploaded, onError }) {
  const [preview, setPreview]     = useState(currentUrl || null);
  const [progress, setProgress]   = useState(null);
  const [uploading, setUploading] = useState(false);
  const [fieldError, setFieldError] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    setPreview(currentUrl || null);
  }, [currentUrl]);

  const handleSelect = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFieldError(null);
    e.target.value = '';

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    setUploading(true);
    setProgress(0);

    try {
      const urls = await uploader(fieldName, file, (pct) => setProgress(pct));
      const urlKey = fieldName === 'photo' ? 'photoUrl' : fieldName === 'cnicFront' ? 'cnicFrontUrl' : 'cnicBackUrl';
      onUploaded(urls[urlKey]);
      setProgress(100);
    } catch (err) {
      const msg = err?.response?.data?.error?.message || err?.message || 'Upload failed. Please try again.';
      setFieldError(msg);
      setPreview(currentUrl || null);
      onUploaded(currentUrl || null);
      onError?.(msg);
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(null), 800);
    }
  }, [fieldName, currentUrl, onUploaded, onError, uploader]);

  const handleRemove = () => {
    setPreview(null);
    setFieldError(null);
    setProgress(null);
    onUploaded(null);
  };

  return (
    <div className="space-y-2">
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        className={`relative aspect-square w-full max-w-[180px] mx-auto rounded-xl border-2 border-dashed
          ${uploading ? 'cursor-wait' : 'cursor-pointer'}
          ${fieldError ? 'border-red-500/60' : 'border-slate-700 hover:border-amber-500/50'}
          bg-slate-950/40 flex flex-col items-center justify-center overflow-hidden group transition-all`}
      >
        {preview ? (
          <img src={preview} alt={label} className="w-full h-full object-cover" />
        ) : (
          <>
            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <ImageIcon className="w-5 h-5 text-slate-400 group-hover:text-amber-400 transition-colors" />
            </div>
            <span className="text-xs font-semibold text-slate-500 group-hover:text-slate-300 transition-colors text-center px-2">
              Click to upload
            </span>
          </>
        )}

        {uploading && (
          <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
            <span className="text-xs font-bold text-amber-300">{progress ?? 0}%</span>
            <div className="w-3/4 h-1 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-200"
                style={{ width: `${progress ?? 0}%` }}
              />
            </div>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleSelect}
          className="hidden"
          disabled={uploading}
        />
      </div>

      {preview && !uploading && (
        <div className="text-center">
          <button
            type="button"
            onClick={handleRemove}
            className="text-xs font-semibold text-red-400 hover:text-red-300 bg-red-500/10 px-3 py-1 rounded-lg border border-red-500/20 transition-colors flex items-center gap-1 mx-auto"
          >
            <X className="w-3 h-3" /> Remove
          </button>
        </div>
      )}

      {fieldError && (
        <p className="text-xs text-red-400 text-center flex items-center justify-center gap-1">
          <AlertCircle className="w-3 h-3 shrink-0" /> {fieldError}
        </p>
      )}
    </div>
  );
}

export default ImageUploadField;
