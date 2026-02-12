import { useLanguage } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { HelpCircle, Wallet, ArrowDownCircle, ShieldCheck, ShieldAlert } from "lucide-react";

export default function FAQPage() {
  const { t } = useLanguage();

  const faqData = [
    {
      category: t.faq.categories.general,
      icon: <HelpCircle className="w-5 h-5 text-primary" />,
      questions: [
        { q: t.faq.questions.whatIsIzichanj, a: t.faq.questions.whatIsIzichanjAns },
      ]
    },
    {
      category: t.faq.categories.deposits,
      icon: <Wallet className="w-5 h-5 text-emerald-500" />,
      questions: [
        { q: t.faq.questions.howToDeposit, a: t.faq.questions.howToDepositAns },
      ]
    },
    {
      category: t.faq.categories.withdrawals,
      icon: <ArrowDownCircle className="w-5 h-5 text-blue-500" />,
      questions: [
        { q: t.faq.questions.howToWithdraw, a: t.faq.questions.howToWithdrawAns },
        { q: t.faq.questions.withdrawalTime, a: t.faq.questions.withdrawalTimeAns },
      ]
    },
    {
      category: t.faq.categories.kyc,
      icon: <ShieldCheck className="w-5 h-5 text-amber-500" />,
      questions: [
        { q: t.faq.questions.whyKyc, a: t.faq.questions.whyKycAns },
      ]
    },
    {
      category: t.faq.categories.security,
      icon: <ShieldAlert className="w-5 h-5 text-indigo-500" />,
      questions: [
        { q: t.faq.questions.isItSecure, a: t.faq.questions.isItSecureAns },
      ]
    }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-display font-bold">{t.faq.title}</h1>
        <p className="text-muted-foreground">{t.faq.subtitle}</p>
      </div>

      <div className="space-y-6">
        {faqData.map((section, idx) => (
          <Card key={idx} className="overflow-hidden border-none shadow-sm">
            <CardHeader className="bg-muted/30 pb-3">
              <div className="flex items-center gap-2">
                {section.icon}
                <CardTitle className="text-lg">{section.category}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <Accordion type="single" collapsible className="w-full">
                {section.questions.map((item, qIdx) => (
                  <AccordionItem key={qIdx} value={`item-${idx}-${qIdx}`} className="border-none">
                    <AccordionTrigger className="text-left hover:no-underline font-medium text-sm py-3 px-2 rounded-md hover:bg-muted/50 transition-colors">
                      {item.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground text-sm px-2 pt-1 pb-3 leading-relaxed">
                      {item.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
