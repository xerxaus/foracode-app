'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  Package,
  Trash2,
  Code,
  Eye,
  Copy,
  Check,
  Search,
  RefreshCw,
  FileArchive,
  X,
  AlertCircle,
  ChevronDown,
  LayoutGrid,
  List,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface PackageData {
  id: string;
  name: string;
  packageType: string;
  uploadDate: string;
  fileSize: number;
  zipStoragePath: string;
  extractedPrefix: string;
  entryPointPath: string;
  isPublic: boolean;
}

const TYPE_COLORS: Record<string, string> = {
  'SCORM 1.2': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  'SCORM 2004': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  'H5P': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  'xAPI': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  'HTML5': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
};

const TYPE_ICONS: Record<string, string> = {
  'SCORM 1.2': '📦',
  'SCORM 2004': '📦',
  'H5P': '🧩',
  'xAPI': '🔗',
  'HTML5': '🌐',
};

function formatFileSize(bytes: number): string {
  const safeBytes = bytes ?? 0;
  if (safeBytes < 1024) return `${safeBytes} B`;
  if (safeBytes < 1024 * 1024) return `${(safeBytes / 1024).toFixed(1)} KB`;
  return `${(safeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr)?.toLocaleDateString?.('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }) ?? '';
  } catch {
    return dateStr ?? '';
  }
}

export function DashboardClient() {
  const [packages, setPackages] = useState<PackageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPackage, setSelectedPackage] = useState<PackageData | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showEmbedCode, setShowEmbedCode] = useState<string | null>(null);
  const [embedCode, setEmbedCode] = useState('');
  const [embedUrl, setEmbedUrl] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const fetchPackages = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/packages');
      const data = await res?.json?.() ?? {};
      setPackages(data?.packages ?? []);
    } catch (err: any) {
      console.error('Failed to fetch packages:', err?.message);
      toast.error('Failed to load packages');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  const handleUpload = useCallback(async (file: File) => {
    if (!file?.name?.toLowerCase?.()?.endsWith?.('.zip')) {
      toast.error('Please upload a ZIP file');
      return;
    }

    setUploading(true);
    setUploadProgress(10);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', file?.name ?? 'package.zip');

      setUploadProgress(30);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      setUploadProgress(80);

      const data = await res?.json?.() ?? {};

      if (!res?.ok) {
        throw new Error(data?.error ?? 'Upload failed');
      }

      setUploadProgress(100);
      toast.success(`Package "${data?.package?.name ?? 'Unknown'}" uploaded successfully!`);
      await fetchPackages();
    } catch (err: any) {
      console.error('Upload error:', err?.message);
      toast.error(err?.message ?? 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }, [fetchPackages]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e?.preventDefault?.();
      setDragOver(false);
      const file = e?.dataTransfer?.files?.[0];
      if (file) handleUpload(file);
    },
    [handleUpload]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e?.target?.files?.[0];
      if (file) handleUpload(file);
    },
    [handleUpload]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/packages/${id}`, { method: 'DELETE' });
        if (!res?.ok) throw new Error('Delete failed');
        toast.success('Package deleted');
        setDeleteConfirm(null);
        await fetchPackages();
      } catch (err: any) {
        console.error('Delete error:', err?.message);
        toast.error('Failed to delete package');
      }
    },
    [fetchPackages]
  );

  const handleGetEmbedCode = useCallback(async (pkg: PackageData) => {
    try {
      const res = await fetch(`/api/packages/${pkg?.id}/embed-url`);
      const data = await res?.json?.() ?? {};
      setEmbedCode(data?.embedCode ?? '');
      setEmbedUrl(data?.embedUrl ?? '');
      setShowEmbedCode(pkg?.id ?? null);
    } catch (err: any) {
      console.error('Failed to get embed code:', err?.message);
      toast.error('Failed to generate embed code');
    }
  }, []);

  const handleCopy = useCallback(async (text: string, id: string) => {
    try {
      await navigator?.clipboard?.writeText?.(text);
      setCopiedId(id);
      toast.success('Copied to clipboard!');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  }, []);

  const handlePreview = useCallback(async (pkg: PackageData) => {
    try {
      const res = await fetch(`/api/packages/${pkg?.id}/embed-url`);
      const data = await res?.json?.() ?? {};
      setEmbedUrl(data?.embedUrl ?? '');
      setSelectedPackage(pkg);
      setShowPreview(true);
    } catch (err: any) {
      console.error('Preview error:', err?.message);
      toast.error('Failed to load preview');
    }
  }, []);

  const filteredPackages = (packages ?? [])?.filter?.((pkg: PackageData) => {
    const q = searchQuery?.toLowerCase?.() ?? '';
    if (!q) return true;
    return (
      pkg?.name?.toLowerCase?.()?.includes?.(q) ||
      pkg?.packageType?.toLowerCase?.()?.includes?.(q)
    );
  }) ?? [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-[1200px] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
              <Package className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display text-lg font-bold tracking-tight">Package Embedder</h1>
              <p className="text-xs text-muted-foreground">SCORM · H5P · HTML5 · xAPI</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchPackages()}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-4 py-8">
        {/* Hero / Upload Area */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="text-center mb-6">
            <h2 className="font-display text-3xl font-bold tracking-tight mb-2">
              Upload & Embed Interactive Packages
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Drop your SCORM, H5P, or HTML5 ZIP files here to generate embed codes for mindmapping boxes and other platforms.
            </p>
          </div>

          <div
            className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ${
              dragOver
                ? 'border-primary bg-primary/5 scale-[1.01]'
                : 'border-border hover:border-primary/50 hover:bg-muted/30'
            } ${uploading ? 'pointer-events-none opacity-60' : 'cursor-pointer'}`}
            onDragOver={(e: React.DragEvent) => { e?.preventDefault?.(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => {
              if (!uploading) {
                document?.getElementById?.('file-input')?.click?.();
              }
            }}
          >
            <input
              id="file-input"
              type="file"
              accept=".zip"
              className="hidden"
              onChange={handleFileSelect}
              disabled={uploading}
            />
            <div className="flex flex-col items-center gap-3">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                {uploading ? (
                  <RefreshCw className="h-8 w-8 text-primary animate-spin" />
                ) : (
                  <Upload className="h-8 w-8 text-primary" />
                )}
              </div>
              {uploading ? (
                <div className="w-full max-w-xs">
                  <p className="font-medium mb-2">Processing package...</p>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-primary rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${uploadProgress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Extracting and hosting files...
                  </p>
                </div>
              ) : (
                <>
                  <p className="font-medium text-lg">Drop your ZIP file here</p>
                  <p className="text-sm text-muted-foreground">
                    or click to browse · Supports SCORM 1.2, SCORM 2004, H5P, xAPI, HTML5
                  </p>
                </>
              )}
            </div>
          </div>
        </motion.div>

        {/* Search & Filter Bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="flex items-center gap-3 mb-6"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search packages..."
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e?.target?.value ?? '')}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'grid' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'list' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
          <Badge variant="secondary" className="font-mono">
            {filteredPackages?.length ?? 0} package{(filteredPackages?.length ?? 0) !== 1 ? 's' : ''}
          </Badge>
        </motion.div>

        {/* Package List */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3]?.map?.((i: number) => (
              <div key={i} className="h-48 bg-muted/50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (filteredPackages?.length ?? 0) === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <FileArchive className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-lg font-medium text-muted-foreground">
              {searchQuery ? 'No packages match your search' : 'No packages uploaded yet'}
            </p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              {searchQuery ? 'Try a different search term' : 'Upload a ZIP file to get started'}
            </p>
          </motion.div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence mode="popLayout">
              {filteredPackages?.map?.((pkg: PackageData, index: number) => (
                <motion.div
                  key={pkg?.id ?? index}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.05 }}
                  layout
                >
                  <Card className="group hover:shadow-lg transition-shadow duration-200 overflow-hidden">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-2xl flex-shrink-0">
                            {TYPE_ICONS[pkg?.packageType ?? ''] ?? '📦'}
                          </span>
                          <div className="min-w-0">
                            <CardTitle className="text-sm font-semibold truncate">
                              {pkg?.name ?? 'Untitled'}
                            </CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {formatDate(pkg?.uploadDate ?? '')}
                            </p>
                          </div>
                        </div>
                        <Badge
                          className={`text-[10px] flex-shrink-0 ${TYPE_COLORS[pkg?.packageType ?? ''] ?? 'bg-gray-100 text-gray-700'}`}
                        >
                          {pkg?.packageType ?? 'Unknown'}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center text-xs text-muted-foreground mb-4 gap-3">
                        <span className="font-mono">{formatFileSize(pkg?.fileSize ?? 0)}</span>
                        <span className="truncate" title={pkg?.entryPointPath ?? ''}>
                          {pkg?.entryPointPath ?? ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          className="flex-1 text-xs"
                          onClick={() => handleGetEmbedCode(pkg)}
                        >
                          <Code className="h-3.5 w-3.5 mr-1" />
                          Embed Code
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePreview(pkg)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant={deleteConfirm === pkg?.id ? 'destructive' : 'outline'}
                          onClick={() => {
                            if (deleteConfirm === pkg?.id) {
                              handleDelete(pkg?.id ?? '');
                            } else {
                              setDeleteConfirm(pkg?.id ?? null);
                              setTimeout(() => setDeleteConfirm(null), 3000);
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      {deleteConfirm === pkg?.id && (
                        <p className="text-xs text-destructive mt-2 text-center">
                          Click delete again to confirm
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              )) ?? []}
            </AnimatePresence>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {filteredPackages?.map?.((pkg: PackageData, index: number) => (
                <motion.div
                  key={pkg?.id ?? index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ delay: index * 0.03 }}
                  layout
                >
                  <Card className="group hover:shadow-md transition-shadow duration-200">
                    <CardContent className="py-3 px-4 flex items-center gap-4">
                      <span className="text-xl flex-shrink-0">
                        {TYPE_ICONS[pkg?.packageType ?? ''] ?? '📦'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{pkg?.name ?? 'Untitled'}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(pkg?.uploadDate ?? '')} · {formatFileSize(pkg?.fileSize ?? 0)}
                        </p>
                      </div>
                      <Badge
                        className={`text-[10px] flex-shrink-0 ${TYPE_COLORS[pkg?.packageType ?? ''] ?? ''}`}
                      >
                        {pkg?.packageType ?? 'Unknown'}
                      </Badge>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button size="sm" variant="default" className="text-xs" onClick={() => handleGetEmbedCode(pkg)}>
                          <Code className="h-3.5 w-3.5 mr-1" />
                          Embed
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handlePreview(pkg)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant={deleteConfirm === pkg?.id ? 'destructive' : 'outline'}
                          onClick={() => {
                            if (deleteConfirm === pkg?.id) {
                              handleDelete(pkg?.id ?? '');
                            } else {
                              setDeleteConfirm(pkg?.id ?? null);
                              setTimeout(() => setDeleteConfirm(null), 3000);
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )) ?? []}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* Embed Code Modal */}
      <AnimatePresence>
        {showEmbedCode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowEmbedCode(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-background rounded-xl shadow-xl max-w-2xl w-full p-6"
              onClick={(e: React.MouseEvent) => e?.stopPropagation?.()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-xl font-bold">Embed Code</h3>
                <Button size="sm" variant="ghost" onClick={() => setShowEmbedCode(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1 block">
                    iframe Embed Code
                  </label>
                  <div className="relative">
                    <pre className="bg-muted rounded-lg p-4 text-sm font-mono overflow-x-auto whitespace-pre-wrap break-all">
                      {embedCode}
                    </pre>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="absolute top-2 right-2"
                      onClick={() => handleCopy(embedCode, 'embed')}
                    >
                      {copiedId === 'embed' ? (
                        <Check className="h-3.5 w-3.5 mr-1" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 mr-1" />
                      )}
                      {copiedId === 'embed' ? 'Copied!' : 'Copy'}
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1 block">
                    Direct URL
                  </label>
                  <div className="relative">
                    <pre className="bg-muted rounded-lg p-4 text-sm font-mono overflow-x-auto whitespace-pre-wrap break-all">
                      {embedUrl}
                    </pre>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="absolute top-2 right-2"
                      onClick={() => handleCopy(embedUrl, 'url')}
                    >
                      {copiedId === 'url' ? (
                        <Check className="h-3.5 w-3.5 mr-1" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 mr-1" />
                      )}
                      {copiedId === 'url' ? 'Copied!' : 'Copy'}
                    </Button>
                  </div>
                </div>
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      Paste the iframe code into your mindmapping box&apos;s HTML embed area. The content will load interactively.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview Modal */}
      <AnimatePresence>
        {showPreview && selectedPackage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowPreview(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-background rounded-xl shadow-xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden"
              onClick={(e: React.MouseEvent) => e?.stopPropagation?.()}
            >
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{TYPE_ICONS[selectedPackage?.packageType ?? ''] ?? '📦'}</span>
                  <div>
                    <h3 className="font-display text-lg font-bold">{selectedPackage?.name ?? 'Preview'}</h3>
                    <p className="text-xs text-muted-foreground">Preview — how it appears when embedded</p>
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setShowPreview(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {/* Simulated Mindmap Box */}
              <div className="flex-1 p-6 bg-muted/30 overflow-auto">
                <div className="mx-auto max-w-3xl">
                  <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-border p-1">
                    <div className="bg-gray-100 dark:bg-gray-800 rounded-t px-3 py-1.5 flex items-center gap-2 text-xs text-muted-foreground border-b border-border">
                      <div className="flex gap-1">
                        <div className="h-2 w-2 rounded-full bg-red-400" />
                        <div className="h-2 w-2 rounded-full bg-yellow-400" />
                        <div className="h-2 w-2 rounded-full bg-green-400" />
                      </div>
                      <span className="font-mono">Mindmap Box — Embedded Content</span>
                    </div>
                    <iframe
                      src={embedUrl}
                      className="w-full rounded-b"
                      style={{ height: '500px', border: 'none' }}
                      title={`Preview: ${selectedPackage?.name ?? 'Package'}`}
                      allowFullScreen
                      allow="autoplay; fullscreen"
                      sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
