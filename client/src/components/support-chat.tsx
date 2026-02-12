import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  MessageCircle,
  X,
  Send,
  Bot,
  User,
  Headphones,
  Loader2,
  ShieldCheck,
  LogOut,
  Star,
  Paperclip,
  FileText,
  Download,
  Image as ImageIcon,
} from "lucide-react";

import { resumeAudioContext } from "./notification-bell";

function playChatBeep() {
  try {
    // We attempt to resume context if it's suspended, although this usually needs 
    // a fresh user gesture to work reliably across all browsers.
    resumeAudioContext();
    
    // We use the same context management logic if possible, but for simplicity here
    // we just wrap the existing logic in a check.
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (audioCtx.state === "suspended") return;

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.frequency.value = 880;
    oscillator.type = "sine";
    gainNode.gain.value = 0.18;
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.25);
  } catch (e) {}
}

function isImageFile(fileName: string) {
  return /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(fileName);
}

function FileAttachment({ fileUrl, fileName, isUser }: { fileUrl: string; fileName: string; isUser: boolean }) {
  const isImage = isImageFile(fileName);
  return (
    <div className="mt-1.5">
      {isImage ? (
        <a href={fileUrl} target="_blank" rel="noopener noreferrer" data-testid="link-file-attachment">
          <img
            src={fileUrl}
            alt={fileName}
            className="max-w-full max-h-32 rounded-md border border-border/30 cursor-pointer"
            data-testid="img-file-attachment"
          />
        </a>
      ) : (
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs ${
            isUser ? "bg-primary-foreground/10" : "bg-muted-foreground/10"
          }`}
          data-testid="link-file-attachment"
        >
          <FileText className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate max-w-[140px]">{fileName}</span>
          <Download className="w-3 h-3 flex-shrink-0" />
        </a>
      )}
    </div>
  );
}

export function SupportChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [showRating, setShowRating] = useState(false);
  const [selectedRating, setSelectedRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevMsgCountRef = useRef(0);
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  const { data: conversation, refetch: refetchConversation } = useQuery<any>({
    queryKey: ["/api/support/conversation"],
    enabled: isOpen,
  });

  const { data: messages = [], isLoading: messagesLoading } = useQuery<any[]>({
    queryKey: ["/api/support/messages", conversation?.id],
    queryFn: async () => {
      if (!conversation?.id) return [];
      const res = await fetch(`/api/support/messages/${conversation.id}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!conversation?.id && isOpen,
    refetchInterval: isOpen ? 5000 : false,
  });

  const sendMutation = useMutation({
    mutationFn: async (payload: { message?: string; fileUrl?: string; fileName?: string }) => {
      const res = await apiRequest("POST", "/api/support/send", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/messages", conversation?.id] });
    },
  });

  const requestAgentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/support/request-agent");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/messages", conversation?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/support/conversation"] });
    },
  });

  const endChatMutation = useMutation({
    mutationFn: async (rating: number) => {
      const res = await apiRequest("POST", "/api/support/end-chat", { rating });
      return res.json();
    },
    onSuccess: () => {
      setShowRating(false);
      setSelectedRating(0);
      queryClient.invalidateQueries({ queryKey: ["/api/support/messages", conversation?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/support/conversation"] });
    },
  });

  useEffect(() => {
    if (messages.length > prevMsgCountRef.current) {
      const newMessages = messages.slice(prevMsgCountRef.current);
      const hasAdminReply = newMessages.some((m: any) => m.sender === "admin");
      if (hasAdminReply) {
        playChatBeep();
      }
    }
    prevMsgCountRef.current = messages.length;
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (conversation?.status === "closed") {
      setShowRating(false);
    }
  }, [conversation?.status]);

  const uploadAndSend = async (file: File, textMessage?: string) => {
    setIsUploading(true);
    try {
      const uploadRes = await apiRequest("POST", "/api/support/upload", {
        name: file.name,
        size: file.size,
        contentType: file.type,
      });
      const { uploadURL, objectPath } = await uploadRes.json();
      await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });
      await sendMutation.mutateAsync({
        message: textMessage || undefined,
        fileUrl: objectPath,
        fileName: file.name,
      });
    } catch (e) {
      console.error("File upload error:", e);
    } finally {
      setIsUploading(false);
      setPendingFile(null);
    }
  };

  const handleSend = () => {
    if (isUploading || sendMutation.isPending) return;
    if (pendingFile) {
      uploadAndSend(pendingFile, message.trim() || undefined);
      setMessage("");
      return;
    }
    if (!message.trim()) return;
    sendMutation.mutate({ message: message.trim() });
    setMessage("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert("File too large (max 10MB)");
      return;
    }
    setPendingFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleEndChat = () => {
    setShowRating(true);
  };

  const handleSubmitRating = () => {
    endChatMutation.mutate(selectedRating);
  };

  const handleNewChat = () => {
    queryClient.removeQueries({ queryKey: ["/api/support/conversation"] });
    queryClient.removeQueries({ queryKey: ["/api/support/messages"] });
    setShowRating(false);
    setSelectedRating(0);
    refetchConversation();
  };

  const isWaitingAgent = conversation?.status === "waiting_agent";
  const isClosed = conversation?.status === "closed";
  const isBusy = sendMutation.isPending || isUploading;

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg"
        data-testid="button-support-chat"
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-96 max-h-[500px] bg-background border border-border rounded-md shadow-lg flex flex-col" data-testid="panel-support-chat">
          <div className="px-4 py-3 border-b border-border bg-primary text-primary-foreground rounded-t-md">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Headphones className="w-5 h-5" />
                <div>
                  <h3 className="font-semibold text-sm">{t.support?.title || "Support Chat"}</h3>
                  <p className="text-xs opacity-80">{t.support?.subtitle || "We're here to help"}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {isWaitingAgent && (
                  <Badge variant="secondary" className="text-xs">
                    {t.support?.waitingAgent || "Waiting for agent"}
                  </Badge>
                )}
                {!isClosed && messages.length > 0 && !showRating && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="text-xs h-7 px-2"
                    onClick={handleEndChat}
                    data-testid="button-end-chat"
                  >
                    <LogOut className="w-3 h-3 mr-1" />
                    {t.support?.endChat || "End Chat"}
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[280px] max-h-[340px]">
            {messages.length === 0 && !messagesLoading && (
              <div className="text-center py-6 space-y-3">
                <Bot className="w-10 h-10 mx-auto text-muted-foreground/40" />
                <div>
                  <p className="text-sm font-medium">{t.support?.welcomeTitle || "Hi! How can we help?"}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t.support?.welcomeMessage || "Ask a question or request to speak with an agent."}</p>
                </div>
                <div className="flex flex-col gap-2 mt-3">
                  {[
                    { text: t.support?.quickDeposit || "How do I deposit?", msg: "How do I deposit USDT?" },
                    { text: t.support?.quickWithdraw || "How do I withdraw?", msg: "How do I withdraw funds?" },
                    { text: t.support?.quickKyc || "KYC verification help", msg: "How does KYC verification work?" },
                  ].map((q, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      size="sm"
                      className="text-xs justify-start"
                      onClick={() => { sendMutation.mutate({ message: q.msg }); }}
                      disabled={isBusy}
                      data-testid={`button-quick-${i}`}
                    >
                      {q.text}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {messagesLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {messages.map((msg: any) => (
              <div
                key={msg.id}
                className={`flex gap-2 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                data-testid={`msg-${msg.sender}-${msg.id}`}
              >
                {msg.sender !== "user" && (
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${msg.sender === "bot" ? "bg-muted" : "bg-primary/10"}`}>
                    {msg.sender === "bot" ? <Bot className="w-3.5 h-3.5 text-muted-foreground" /> : <ShieldCheck className="w-3.5 h-3.5 text-primary" />}
                  </div>
                )}
                <div
                  className={`max-w-[75%] px-3 py-2 rounded-md text-sm whitespace-pre-wrap ${
                    msg.sender === "user"
                      ? "bg-primary text-primary-foreground"
                      : msg.sender === "admin"
                      ? "bg-muted border border-border"
                      : "bg-muted"
                  }`}
                >
                  {msg.sender === "admin" && (
                    <p className="text-[10px] font-medium text-primary mb-1">{t.support?.agentLabel || "Support Agent"}</p>
                  )}
                  {(!msg.fileUrl || (msg.message && !msg.message.startsWith("Sent a file:"))) && msg.message}
                  {msg.fileUrl && (
                    <FileAttachment fileUrl={msg.fileUrl} fileName={msg.fileName || "file"} isUser={msg.sender === "user"} />
                  )}
                </div>
                {msg.sender === "user" && (
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <User className="w-3.5 h-3.5 text-primary" />
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {showRating && !isClosed && (
            <div className="px-3 py-4 border-t border-border bg-muted/30">
              <p className="text-sm font-medium text-center mb-2">{t.support?.rateTitle || "Rate your experience"}</p>
              <p className="text-xs text-muted-foreground text-center mb-3">{t.support?.rateMessage || "How was your support experience?"}</p>
              <div className="flex justify-center gap-1 mb-3">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setSelectedRating(star)}
                    onMouseEnter={() => setHoveredRating(star)}
                    onMouseLeave={() => setHoveredRating(0)}
                    className="p-1 transition-transform"
                    data-testid={`button-star-${star}`}
                  >
                    <Star
                      className={`w-7 h-7 transition-colors ${
                        star <= (hoveredRating || selectedRating)
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-muted-foreground/30"
                      }`}
                    />
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => setShowRating(false)}
                  data-testid="button-cancel-rating"
                >
                  {t.support?.cancelRating || "Cancel"}
                </Button>
                <Button
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={handleSubmitRating}
                  disabled={selectedRating === 0 || endChatMutation.isPending}
                  data-testid="button-submit-rating"
                >
                  {endChatMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                  {t.support?.submitRating || "End Chat"}
                </Button>
              </div>
            </div>
          )}

          {isClosed && (
            <div className="px-3 py-4 border-t border-border bg-muted/30 text-center">
              <p className="text-sm text-muted-foreground mb-2">{t.support?.chatEnded || "This conversation has ended"}</p>
              {conversation?.rating && (
                <div className="flex justify-center gap-0.5 mb-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-4 h-4 ${
                        star <= conversation.rating
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-muted-foreground/30"
                      }`}
                    />
                  ))}
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={handleNewChat}
                data-testid="button-new-chat"
              >
                <MessageCircle className="w-3 h-3 mr-1.5" />
                {t.support?.startNewChat || "Start New Chat"}
              </Button>
            </div>
          )}

          {!isClosed && !showRating && (
            <>
              {!isWaitingAgent && messages.length > 0 && (
                <div className="px-3 pb-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => requestAgentMutation.mutate()}
                    disabled={requestAgentMutation.isPending}
                    data-testid="button-request-agent"
                  >
                    <Headphones className="w-3 h-3 mr-1.5" />
                    {t.support?.talkToAgent || "Talk to a support agent"}
                  </Button>
                </div>
              )}

              {pendingFile && (
                <div className="px-3 pb-1">
                  <div className="flex items-center gap-2 px-2 py-1.5 bg-muted rounded-md text-xs">
                    {isImageFile(pendingFile.name) ? (
                      <ImageIcon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    )}
                    <span className="truncate flex-1">{pendingFile.name}</span>
                    <button
                      onClick={() => setPendingFile(null)}
                      className="text-muted-foreground"
                      data-testid="button-remove-file"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              <div className="px-3 pb-3 pt-2 border-t border-border">
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileSelect}
                    accept="image/*,.pdf,.doc,.docx,.txt,.zip"
                    data-testid="input-file-upload"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isBusy}
                    data-testid="button-attach-file"
                  >
                    <Paperclip className="w-4 h-4" />
                  </Button>
                  <Input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t.support?.placeholder || "Type your message..."}
                    className="flex-1 text-sm"
                    disabled={isBusy}
                    data-testid="input-support-message"
                  />
                  <Button
                    size="icon"
                    onClick={handleSend}
                    disabled={(!message.trim() && !pendingFile) || isBusy}
                    data-testid="button-send-support"
                  >
                    {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
