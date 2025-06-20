"use client";
import { Button } from " @/components/ui/button";
import { Input } from " @/components/ui/input";
import * as React from "react";
import { Bot, User, Loader2, FileText, Upload, Sparkles, Cpu, File, X, Check, AlertCircle } from "lucide-react";
import { UserButton } from "@clerk/nextjs";

interface Doc {
  pageContent?: string;
  metadata: {
    source?: string;
    loc?: {
      pageNumber?: number;
    };
  };
}

interface IMessage {
  role: "assistant" | "user";
  content?: string;
  documents?: Doc[];
}

interface UploadedFile {
  id: string;
  name: string;
  size: string;
  progress: number;
  status: 'uploading' | 'success' | 'error';
}

export default function PDFChatPage() {
  const [message, setMessage] = React.useState<string>("");
  const [messages, setMessages] = React.useState<IMessage[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [uploadedFiles, setUploadedFiles] = React.useState<UploadedFile[]>([]);
  const [activeDocument, setActiveDocument] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const messagesContainerRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll to the latest message
  React.useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendChatMessage = async () => {
    if (!message.trim()) return;

    const userMessage = { role: "user" as const, content: message };
    setMessages((prev) => [...prev, userMessage]);
    setMessage("");
    setIsLoading(true);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/chat?message=${encodeURIComponent(message)}&document=${activeDocument || ''}`
      );
      
      if (!res.ok) throw new Error(`Server responded with ${res.status}`);
      
      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data?.response || "No response received",
          documents: data?.documents || [],
        },
      ]);
    } catch (error) {
      console.error("Error in chat:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "⚠️ System error. Neural network response failed.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const newFiles: UploadedFile[] = Array.from(e.target.files).map(file => ({
      id: Math.random().toString(36).substring(2, 9),
      name: file.name,
      size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
      progress: 0,
      status: 'uploading',
    }));

    setUploadedFiles(prev => [...prev, ...newFiles]);

    // Upload files sequentially with progress tracking
    for (const file of Array.from(e.target.files)) {
      const fileId = newFiles.find(f => f.name === file.name)?.id;
      if (!fileId) continue;

      try {
        const formData = new FormData();
        formData.append('pdf', file);

        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100);
            setUploadedFiles(prev => prev.map(f => 
              f.id === fileId ? {...f, progress} : f
            ));
          }
        });

        await new Promise((resolve, reject) => {
          xhr.onreadystatechange = () => {
            if (xhr.readyState === 4) {
              if (xhr.status === 200) {
                setUploadedFiles(prev => prev.map(f => 
                  f.id === fileId ? {...f, status: 'success', progress: 100} : f
                ));
                resolve(xhr.response);
              } else {
                setUploadedFiles(prev => prev.map(f => 
                  f.id === fileId ? {...f, status: 'error'} : f
                ));
                reject(new Error('Upload failed'));
              }
            }
          };

          xhr.open('POST', `${process.env.NEXT_PUBLIC_BACKEND_URL}/upload/pdf`, true);
          xhr.send(formData);
        });

        setMessages(prev => [...prev, {
          role: "assistant",
          content: `Document "${file.name}" uploaded successfully. You can now ask questions about it.`
        }]);

        // Set the first uploaded document as active
        if (!activeDocument) {
          setActiveDocument(file.name);
        }
      } catch (error) {
        console.error("Upload error:", error);
        setMessages(prev => [...prev, {
          role: "assistant",
          content: `⚠️ Failed to upload document "${file.name}". Please try again.`
        }]);
      }
    }
  };

  const removeFile = (id: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== id));
    if (activeDocument === id) {
      setActiveDocument(uploadedFiles.find(f => f.id !== id)?.id || null);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex h-screen bg-black text-white">
      {/* Left Sidebar - Upload Section */}
      <div className="w-[30%] border-r border-gray-800 p-6 flex flex-col">
        <div className="flex items-center gap-3 mb-8">
          <Cpu className="text-white" size={24} />
          <h1 className="text-xl font-mono font-bold tracking-tighter">
            PDF<span className="text-blue-400">_</span>RAG
          </h1>
        </div>
        
        <div className="flex-1 flex flex-col">
          {/* Upload Area */}
          <div 
            className={`bg-gray-900 text-white p-6 rounded-xl border-2 border-dashed border-gray-700 hover:border-blue-500 transition-colors cursor-pointer mb-6
                      ${uploadedFiles.some(f => f.status === 'uploading') ? 'opacity-50' : ''}`}
            onClick={triggerFileInput}
          >
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="p-4 bg-gray-800 rounded-full">
                <Upload className="text-blue-400" size={24} />
              </div>
              <h3 className="text-lg font-medium">Upload PDF Files</h3>
              <p className="text-sm text-gray-400 text-center max-w-xs">
                Drag and drop your PDF files here, or click to browse
              </p>
              <input 
                ref={fileInputRef}
                type="file" 
                className="hidden" 
                accept="application/pdf" 
                onChange={handleFileUpload}
                multiple
                disabled={uploadedFiles.some(f => f.status === 'uploading')}
              />
            </div>
          </div>

          {/* Uploaded Files List */}
          <div className="flex-1 overflow-y-auto max-h-60">
            <h4 className="text-sm font-mono text-gray-400 mb-2">UPLOADED DOCUMENTS:</h4>
            {uploadedFiles.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No documents uploaded yet</p>
            ) : (
              <ul className="space-y-2">
                {uploadedFiles.map((file) => (
                  <li 
                    key={file.id}
                    className={`text-sm p-3 rounded border ${file.id === activeDocument ? 'border-blue-500 bg-blue-900/20' : 'border-gray-700 bg-gray-800'} hover:bg-gray-700 cursor-pointer transition-colors`}
                    onClick={() => setActiveDocument(file.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 truncate">
                        <FileText size={16} className="flex-shrink-0" />
                        <span className="truncate">{file.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {file.status === 'uploading' && (
                          <Loader2 className="animate-spin h-4 w-4" />
                        )}
                        {file.status === 'success' && (
                          <Check className="h-4 w-4 text-green-500" />
                        )}
                        {file.status === 'error' && (
                          <AlertCircle className="h-4 w-4 text-red-500" />
                        )}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile(file.id);
                          }}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    {file.status === 'uploading' && (
                      <div className="mt-2 w-full bg-gray-700 rounded-full h-1.5">
                        <div 
                          className="bg-blue-500 h-1.5 rounded-full" 
                          style={{ width: `${file.progress}%` }}
                        ></div>
                      </div>
                    )}
                    <div className="text-xs text-gray-400 mt-1">{file.size}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Example Queries */}
          <div className="mt-4 w-full">
            <h4 className="text-sm font-mono text-gray-400 mb-2">EXAMPLE QUERIES:</h4>
            <ul className="space-y-2">
              <li className="text-sm p-3 bg-gray-800 rounded border border-gray-700 hover:bg-gray-700 cursor-pointer"
                  onClick={() => setMessage("What are the key points from the document?")}>
                <span className="text-blue-400"></span> Key points summary
              </li>
              <li className="text-sm p-3 bg-gray-800 rounded border border-gray-700 hover:bg-gray-700 cursor-pointer"
                  onClick={() => setMessage("Can you summarize page 5?")}>
                <span className="text-blue-400"></span> Summarize specific page
              </li>
              <li className="text-sm p-3 bg-gray-800 rounded border border-gray-700 hover:bg-gray-700 cursor-pointer"
                  onClick={() => setMessage("Find all references to...")}>
                <span className="text-blue-400"></span> Find specific information
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Right Side - Chat Section */}
      <div className="w-[70%] flex flex-col">
        {/* Header */}
        <header className="border-b border-gray-800 py-4 px-6 bg-gradient-to-r from-black via-gray-900 to-black">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Cpu className="text-white" size={24} />
                <Sparkles className="absolute -top-1 -right-1 text-blue-400" size={12} />
              </div>
              <h1 className="text-xl font-mono font-bold tracking-tighter">
                PDF<span className="text-blue-400">_</span>CHAT
              </h1>
              {activeDocument && (
                <div className="ml-4 text-sm text-gray-400 flex items-center gap-2">
                  <FileText size={14} />
                  <span className="truncate max-w-xs">
                    {uploadedFiles.find(f => f.id === activeDocument)?.name}
                  </span>
                </div>
              )}
            </div>
            <div className="flex justify-end p-4">
              <UserButton />
            </div>
          </div>
        </header>

        {/* Message Container */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto py-6 px-6 space-y-6 relative"
        >
          {messages.length === 0 && (
            <div className="flex flex-col h-full items-center justify-center text-center p-6">
              <div className="bg-gray-900 p-8 rounded-xl border border-gray-800 max-w-md w-full">
                <div className="flex justify-center mb-4">
                  <div className="bg-gray-800 p-3 rounded-full border border-gray-700">
                    <Bot className="text-blue-400" size={24} />
                  </div>
                </div>
                <h2 className="text-lg font-medium mb-3 font-mono tracking-tight">
                  {uploadedFiles.length > 0 ? 'SELECT A DOCUMENT TO CHAT' : 'UPLOAD DOCUMENTS TO BEGIN'}
                </h2>
                <p className="text-gray-400 text-sm mb-6">
                  {uploadedFiles.length > 0 
                    ? 'Select a document from the left panel to start chatting'
                    : 'Upload PDF documents on the left, then ask questions about their content here.'}
                </p>
              </div>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {message.role === "assistant" && (
                <div className="flex-shrink-0 mt-1">
                  <div className="bg-gray-800 p-2 rounded-full border border-gray-700">
                    <Bot className="text-blue-400" size={18} />
                  </div>
                </div>
              )}
              <div
                className={`p-4 rounded-xl max-w-[85%] sm:max-w-[75%] transition-colors ${
                  message.role === "user"
                    ? "bg-gray-800 text-white border border-gray-700"
                    : "bg-gray-900 text-gray-100 border border-gray-800"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {message.role === "user" ? (
                    <User size={16} className="text-gray-400" />
                  ) : (
                    <Bot size={16} className="text-blue-400" />
                  )}
                  <span className="text-xs font-medium font-mono">
                    {message.role === "user" ? "USER" : "AI"}
                  </span>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {message.content || "No content"}
                </p>
                {message.documents && message.documents.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-800">
                    <p className="text-xs font-medium text-gray-400 mb-1 font-mono">SOURCE REFERENCES:</p>
                    <div className="space-y-1">
                      {message.documents.map((doc, docIndex) => (
                        <div
                          key={docIndex}
                          className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-300 flex items-start gap-2 border border-gray-700"
                        >
                          <FileText size={12} className="mt-0.5 flex-shrink-0 text-gray-500" />
                          <div>
                            <p className="font-medium truncate max-w-full font-mono">
                              {doc.metadata.source || "UNKNOWN_SOURCE"}
                            </p>
                            {doc.metadata.loc?.pageNumber && (
                              <p className="text-gray-500 text-xs">
                                PAGE_{doc.metadata.loc.pageNumber}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {message.role === "user" && (
                <div className="flex-shrink-0 mt-1">
                  <div className="bg-gray-800 p-2 rounded-full border border-gray-700">
                    <User className="text-gray-400" size={18} />
                  </div>
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="flex-shrink-0 mt-1">
                <div className="bg-gray-800 p-2 rounded-full border border-gray-700">
                  <Bot className="text-blue-400" size={18} />
                </div>
              </div>
              <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl max-w-[75%]">
                <div className="flex items-center gap-2 text-gray-400">
                  <Loader2 className="animate-spin" size={16} />
                  <span className="text-sm font-mono">PROCESSING...</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-800 bg-gray-900 py-4 px-6">
          <div className="flex gap-2 bg-gray-800 p-2 rounded-lg border border-gray-700">
            <Input
              value={message}
              placeholder={activeDocument 
                ? `Ask a question about ${uploadedFiles.find(f => f.id === activeDocument)?.name}...` 
                : "Upload and select a document to begin chatting..."}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && !isLoading && handleSendChatMessage()}
              className="flex-1 border-none text-sm bg-gray-800 text-white focus:ring-0 focus:outline-none placeholder-gray-500"
              disabled={isLoading || !activeDocument}
            />
            <Button
              onClick={handleSendChatMessage}
              disabled={isLoading || !message.trim() || !activeDocument}
              className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-5 py-2 text-sm font-mono border border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="animate-spin h-4 w-4" />
              ) : (
                "SEND"
              )}
            </Button>
          </div>
          <p className="text-xs text-center text-gray-500 mt-2 font-mono">
            {activeDocument 
              ? `Analyzing: ${uploadedFiles.find(f => f.id === activeDocument)?.name}` 
              : "Please upload and select a PDF document first"}
          </p>
        </div>
      </div>
    </div>
  );
}