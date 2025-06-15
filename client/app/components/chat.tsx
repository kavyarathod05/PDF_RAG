"use client";
import { Button } from " @/components/ui/button";
import { Input } from " @/components/ui/input";
import * as React from "react";

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

const ChatComponent: React.FC = () => {
  const [message, setMessage] = React.useState<string>("");
  const [messages, setMessages] = React.useState<IMessage[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll to the latest message
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendChatMessage = async () => {
    if (!message.trim()) return;

    setMessages((prev) => [...prev, { role: "user", content: message }]);
    setMessage("");
    setIsLoading(true);

    try {
      console.log(process.env.NEXT_PUBLIC_BACKEND_URL);
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/chat?message=${encodeURIComponent(message)}`
        // `http://localhost:8000/chat?message=${encodeURIComponent(message)}`

      );
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
          content: "⚠️ Failed to get response from server.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-3xl mx-auto px-4 sm:px-6 bg-gray-100">
      {/* Message Container */}
      <div
        className="flex-1 overflow-y-auto py-6 space-y-6"
        style={{ paddingBottom: "110px" }}
      >
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-gray-600 text-sm font-medium">
            Start chatting by typing your query below
          </div>
        )}
        {messages.map((message, index) => (
          <div
            key={index}
            className={`p-4 rounded-xl max-w-[85%] sm:max-w-[75%] shadow-md transition-colors ${
              message.role === "user"
                ? "ml-auto bg-blue-500 text-white hover:bg-blue-600"
                : "mr-auto bg-white text-gray-800 border border-gray-300 hover:border-gray-400"
            }`}
          >
            <p className="text-sm leading-relaxed">{message.content || "No content"}</p>
            {message.documents && message.documents.length > 0 && (
              <div className="mt-3 text-xs text-gray-600">
                <p className="font-semibold text-gray-700">Sources:</p>
                {message.documents.map((doc, docIndex) => (
                  <p key={docIndex} className="truncate max-w-full">
                    {doc.metadata.source || "Unknown source"}
                    {doc.metadata.loc?.pageNumber ? ` (Page ${doc.metadata.loc.pageNumber})` : ""}
                  </p>
                ))}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Fixed Input and Button */}
      <div className="fixed bottom-4 left-150 right-40 mask-x-from-95% mx-auto px-4 sm:px-6 z-10">
        <div className="flex gap-3 bg-white p-3 rounded-xl shadow-lg border border-gray-300">
          <Input
            value={message}
            placeholder="Type your query here..."
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && !isLoading && handleSendChatMessage()}
            className="flex-1 border-none text-sm bg-transparent focus:ring-0 focus:outline-none"
            disabled={isLoading}
          />
          <Button
            onClick={handleSendChatMessage}
            disabled={isLoading || !message.trim()}
            className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-5 py-2 text-sm"
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatComponent;