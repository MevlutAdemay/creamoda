'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, Image as ImageIcon, X } from 'lucide-react';
import { useToast } from '@/components/ui/ToastCenter';
import Image from 'next/image';

type ImageUploadButtonProps = {
  currentImageUrl?: string | null;
  onImageUploaded: (url: string) => void;
  studioId?: string; // For table row uploads
  studioTitle?: string; // For filename
  compact?: boolean; // Compact mode for table cells
};

export function ImageUploadButton({
  currentImageUrl,
  onImageUploaded,
  studioId,
  studioTitle,
  compact = false,
}: ImageUploadButtonProps) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Error',
        message: 'Please select an image file',
        kind: 'error',
      });
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'design-studios');
      
      // Use studio code/title for filename if available
      const filenameBase = studioTitle 
        ? studioTitle.toLowerCase().replace(/[^a-z0-9]/g, '-')
        : studioId || 'studio';
      formData.append('filenameBase', filenameBase);

      const res = await fetch('/api/admin/blob/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Upload failed');
      }

      const data = await res.json();
      setPreviewUrl(data.url);
      onImageUploaded(data.url);

      toast({
        title: 'Success',
        message: 'Image uploaded successfully',
        kind: 'success',
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to upload image',
        kind: 'error',
      });
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = () => {
    setPreviewUrl(null);
    onImageUploaded('');
  };

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploading}
      />

      {previewUrl ? (
        <div className="relative group">
          <div className={`relative ${compact ? 'w-20 h-20' : 'w-full h-32'} border rounded-md overflow-hidden bg-muted`}>
            <Image
              src={previewUrl}
              alt="Cover preview"
              fill
              className="object-cover"
              sizes={compact ? '80px' : '(max-width: 768px) 100vw, 300px'}
            />
          </div>
          {!compact && (
            <div className="flex gap-2 mt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex-1"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Replace
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRemove}
                disabled={uploading}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
          {compact && (
            <div className="flex gap-1 mt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="h-6 px-2"
                title="Replace image"
              >
                {uploading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Upload className="w-3 h-3" />
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemove}
                disabled={uploading}
                className="h-6 px-2"
                title="Remove image"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          )}
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className={compact ? 'w-full h-20' : 'w-full'}
          size={compact ? 'sm' : 'default'}
        >
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {compact ? '...' : 'Uploading...'}
            </>
          ) : (
            <>
              <ImageIcon className="w-4 h-4 mr-2" />
              {compact ? 'Upload' : 'Upload Cover Image'}
            </>
          )}
        </Button>
      )}
    </div>
  );
}
