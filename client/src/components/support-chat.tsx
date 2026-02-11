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
} from "lucide-react";

export function SupportChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [showRating, setShowRating] = useState(false);
  const [selectedRating, setSelectedRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
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
    mutationFn: async (msg: string) => {
      const res = await apiRequest("POST", "/api/support/send", { message: msg });
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
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (conversation?.status === "closed") {
      setShowRating(false);
    }
  }, [conversation?.status]);

  const handleSend = () => {
    if (!message.trim() || sendMutation.isPending) return;
    sendMutation.mutate(message.trim());
    setMessage("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
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
                      onClick={() => { sendMutation.mutate(q.msg); }}
                      disabled={sendMutation.isPending}
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
                  {msg.message}
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

              <div className="px-3 pb-3 pt-2 border-t border-border">
                <div className="flex items-center gap-2">
                  <Input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t.support?.placeholder || "Type your message..."}
                    className="flex-1 text-sm"
                    disabled={sendMutation.isPending}
                    data-testid="input-support-message"
                  />
                  <Button
                    size="icon"
                    onClick={handleSend}
                    disabled={!message.trim() || sendMutation.isPending}
                    data-testid="button-send-support"
                  >
                    {sendMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
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
