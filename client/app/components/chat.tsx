"use client";
import { Button } from " @/components/ui/button";
import { Input } from " @/components/ui/input";

import * as React from "react";
import { Bot, User, Loader2, FileText, Upload, Sparkles, Cpu, File } from "lucide-react";
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

export default function PDFChatPage() {
  const [message, setMessage] = React.useState<string>("");
  const [messages, setMessages] = React.useState<IMessage[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [isUploading, setIsUploading] = React.useState<boolean>(false);
  const [uploadedFileName, setUploadedFileName] = React.useState<string | null>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
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
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/chat?message=${encodeURIComponent(message)}`
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
    setIsUploading(true);
    
    try {
      const file = e.target.files[0];
      setUploadedFileName(file.name);
      console.log(file);
      const formData = new FormData();
      formData.append('pdf', file);
      console.log(formData);
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/upload/pdf`, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) throw new Error('Upload failed');
      
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `Document "${file.name}" uploaded successfully. You can now ask questions about it.`
      }]);
    } catch (error) {
      console.error("Upload error:", error);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "⚠️ Failed to upload document. Please try again."
      }]);
    } finally {
      setIsUploading(false);
    }
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
        
        <div className="flex-1 flex flex-col items-center justify-center">
          <div 
            className={`bg-gray-900 text-white p-8 rounded-xl border-2 border-dashed border-gray-700 hover:border-blue-500 transition-colors cursor-pointer 
                      ${isUploading ? 'opacity-50' : ''}`}
          >
            <label className="flex flex-col items-center justify-center gap-4">
              <div className="p-4 bg-gray-800 rounded-full">
                <Upload className="text-blue-400" size={24} />
              </div>
              <h3 className="text-lg font-medium">Upload PDF File</h3>
              <p className="text-sm text-gray-400 text-center max-w-xs">
                Drag and drop your PDF file here, or click to browse
              </p>
              {uploadedFileName && (
                <div className="mt-4 flex items-center gap-2 text-sm text-blue-400">
                  <File size={16} />
                  <span className="truncate max-w-xs">{uploadedFileName}</span>
                </div>
              )}
              <input 
                type="file" 
                className="hidden" 
                accept="application/pdf" 
                onChange={handleFileUpload}
                disabled={isUploading}
              />
            </label>
          </div>
          
          {isUploading && (
            <div className="mt-4 flex items-center gap-2 text-gray-400">
              <Loader2 className="animate-spin" size={16} />
              <span>Processing document...</span>
            </div>
          )}
          
          <div className="mt-8 w-full">
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
            </div>
            {/* <div className="text-xs text-gray-400 font-mono">
              DOCUMENT ANALYSIS SYSTEM
            </div> */}
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
                  DOCUMENT CHAT READY
                </h2>
                <p className="text-gray-400 text-sm mb-6">
                  Upload a PDF document on the left, then ask questions about its content here.
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
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-800 bg-gray-900 py-4 px-6">
          <div className="flex gap-2 bg-gray-800 p-2 rounded-lg border border-gray-700">
            <Input
              value={message}
              placeholder="Ask a question about the document..."
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && !isLoading && handleSendChatMessage()}
              className="flex-1 border-none text-sm bg-gray-800 text-white focus:ring-0 focus:outline-none placeholder-gray-500"
              disabled={isLoading || !uploadedFileName}
            />
            <Button
              onClick={handleSendChatMessage}
              disabled={isLoading || !message.trim() || !uploadedFileName}
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
            {uploadedFileName 
              ? `Analyzing: ${uploadedFileName}` 
              : "Please upload a PDF document first"}
          </p>
        </div>
      </div>
    </div>
  );
}