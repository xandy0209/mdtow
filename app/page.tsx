'use client';

import { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { Upload, FileText, Download, RefreshCw, PenLine } from 'lucide-react';
import { convertMarkdownToDocx } from '@/lib/markdown-to-docx';

export default function Home() {
  const [markdown, setMarkdown] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [showEditor, setShowEditor] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
        if (file) {
            if (!file.name.endsWith('.md')) {
                console.error('Please upload a Markdown (.md) file.');
                return;
            }
            processFile(file);
        }
    };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const processFile = (file: File) => {
    setFileName(file.name.replace('.md', ''));
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setMarkdown(content);
      setShowEditor(true);
    };
    reader.readAsText(file);
  };

  const handleConvert = async () => {
    if (!markdown) return;
    setIsConverting(true);
    try {
      const blob = await convertMarkdownToDocx(markdown);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName || 'document'}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Conversion failed:', error);
    } finally {
      setIsConverting(false);
    }
  };


  return (
    <main className="h-screen flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
      {/* Background Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob" />
      <div className="absolute top-[-10%] right-[-10%] w-[40vw] h-[40vw] bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="z-10 w-full max-w-4xl flex flex-col h-[85vh]"
      >
        <div className="text-center mb-6 shrink-0">
          <h1 
            className="text-3xl md:text-5xl font-bold text-gray-800 mb-2 tracking-tight"
          >
            Markdown 转 <span className="text-blue-600">Word</span>
          </h1>
          <p className="text-base text-gray-600 max-w-2xl mx-auto">
            优雅的转换体验，专业级排版。自动应用宋体、1.5倍行距和首行缩进。
          </p>
        </div>

        <div className="glass-panel rounded-2xl p-6 w-full flex-1 flex flex-col shadow-2xl border border-white/50 relative overflow-hidden min-h-0">
          {!showEditor ? (
            <div
              className={`flex-1 border-3 border-dashed rounded-xl flex flex-col items-center justify-center transition-all duration-300 cursor-pointer group relative z-20 ${
                isDragging
                  ? 'border-blue-500 bg-blue-50/50 scale-[0.99]'
                  : 'border-gray-300 hover:border-blue-400 hover:bg-white/30'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".md"
                onChange={handleFileSelect}
              />
              <div className="w-16 h-16 bg-white rounded-full shadow-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <Upload className="w-8 h-8 text-blue-500" />
              </div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                上传 Markdown 文件
              </h3>
              <p className="text-gray-500 mb-6">拖拽文件到这里或点击浏览</p>

              <div className="flex items-center gap-4 w-full max-w-xs">
                <div className="h-px bg-gray-300 flex-1"></div>
                <span className="text-gray-400 text-sm">或</span>
                <div className="h-px bg-gray-300 flex-1"></div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowEditor(true);
                  setFileName('新建文档');
                }}
                className="mt-6 px-6 py-2 bg-white/80 hover:bg-white text-gray-600 rounded-full text-sm font-medium shadow-sm border border-gray-200 transition-all hover:shadow-md flex items-center gap-2"
              >
                <PenLine className="w-4 h-4" />
                直接输入内容
              </button>
            </div>
          ) : (
            <div className="flex flex-col h-full relative z-20">
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200/50 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 truncate max-w-[200px]">
                      {fileName || '新建文档'}
                    </h3>
                    <p className="text-xs text-gray-500">准备转换</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setMarkdown('');
                    setFileName('');
                    setShowEditor(false);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 bg-white/50 rounded-lg p-4 mb-4 border border-white/60 shadow-inner min-h-0">
                <textarea
                  className="w-full h-full resize-none bg-transparent outline-none font-mono text-xs md:text-sm text-gray-700 placeholder-gray-400"
                  value={markdown}
                  onChange={(e) => setMarkdown(e.target.value)}
                  placeholder="# 在此输入 Markdown 内容..."
                  spellCheck={false}
                />
              </div>

              <div className="flex justify-between items-center shrink-0">
                <p className="text-xs text-gray-500 italic">
                  * 导出后若目录为空，请在 Word 中右键目录选择“更新域”
                </p>
                <button
                  onClick={handleConvert}
                  disabled={isConverting || !markdown.trim()}
                  className="group relative px-6 py-3 bg-gray-900 text-white rounded-xl font-semibold text-base shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:cursor-not-allowed overflow-hidden"
                >
                  <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-blue-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <span className="relative flex items-center gap-2">
                    {isConverting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        转换中...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        下载 Word 文档
                      </>
                    )}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </main>
  );
}
