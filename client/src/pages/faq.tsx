import { useLanguage } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { HelpCircle, Wallet, ArrowDownCircle, ShieldCheck, ShieldAlert, Lock, RefreshCcw } from "lucide-react";

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

  const privacyPolicy = [
    {
      title: "1. Information We Collect",
      content: "When you use Izichanj, we may collect the following information:\n• Personal Information: name, email address, phone number, and other information you provide when creating an account.\n• Transaction Information: details related to payments, transfers, and transaction IDs.\n• Technical Information: IP address, device type, browser type, and usage data.\n• Communication Data: messages sent to customer support."
    },
    {
      title: "2. How We Use Your Information",
      content: "Izichanj uses collected information to:\n• Provide and operate our payment services\n• Process transactions and verify payments\n• Prevent fraud and illegal activities\n• Improve our platform and user experience\n• Communicate with users regarding transactions or support"
    },
    {
      title: "3. Data Protection",
      content: "We implement appropriate security measures to protect your personal information, including:\n• Secure servers\n• Encryption technologies\n• Access control systems\n\nHowever, no internet transmission is 100% secure."
    },
    {
      title: "4. Sharing of Information",
      content: "Izichanj does not sell your personal data. We may share information only:\n• When required by law\n• To prevent fraud or illegal activities\n• With trusted service providers that help operate the platform"
    },
    {
      title: "5. Cookies and Tracking",
      content: "Izichanj may use cookies and similar technologies to:\n• Improve website functionality\n• Remember user preferences\n• Analyze usage patterns\n\nUsers can disable cookies in their browser settings."
    },
    {
      title: "6. User Rights",
      content: "Users have the right to:\n• Access their personal data\n• Request correction of incorrect information\n• Request deletion of their account\n\nTo request these actions, contact our support team."
    },
    {
      title: "7. Changes to this Policy",
      content: "Izichanj may update this Privacy Policy at any time. Users will be notified when significant changes occur."
    },
  ];

  const refundPolicy = [
    {
      title: "1. General Rule",
      content: "All completed transactions on Izichanj are considered final and non-refundable once they have been successfully processed on the network.\n\nBecause blockchain and digital transfers are irreversible, Izichanj cannot cancel or reverse confirmed transactions."
    },
    {
      title: "2. Eligible Refund Situations",
      content: "A refund may be considered only in the following cases:\n• Duplicate payments caused by a system error\n• Payment processed but service not delivered\n• Technical errors within the Izichanj platform\n\nEach case will be reviewed by the Izichanj support team."
    },
    {
      title: "3. Non-Refundable Situations",
      content: "Refunds will not be issued for:\n• Incorrect wallet addresses entered by the user\n• User mistakes during transactions\n• Blockchain network fees\n• Completed and confirmed transfers"
    },
    {
      title: "4. Refund Request Process",
      content: "To request a refund, users must:\n• Contact Izichanj support\n• Provide the transaction ID\n• Provide proof of payment\n• Explain the issue\n\nRequests must be submitted within 48 hours of the transaction."
    },
    {
      title: "5. Processing Time",
      content: "If a refund request is approved, it may take 3–7 business days to process depending on payment method and verification procedures."
    },
    {
      title: "6. Fraud Prevention",
      content: "Izichanj reserves the right to deny refund requests if fraud, abuse, or suspicious activity is detected."
    },
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

        <Card className="overflow-hidden border-none shadow-sm">
          <CardHeader className="bg-muted/30 pb-3">
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-violet-500" />
              <CardTitle className="text-lg">Privacy Policy</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Last Updated: March 2026</p>
          </CardHeader>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground mb-4">
              Welcome to Izichanj. Your privacy is important to us. This Privacy Policy explains how we collect, use, and protect your information when you use our services.
            </p>
            <Accordion type="single" collapsible className="w-full">
              {privacyPolicy.map((item, idx) => (
                <AccordionItem key={idx} value={`privacy-${idx}`} className="border-none">
                  <AccordionTrigger className="text-left hover:no-underline font-medium text-sm py-3 px-2 rounded-md hover:bg-muted/50 transition-colors">
                    {item.title}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-sm px-2 pt-1 pb-3 leading-relaxed whitespace-pre-line">
                    {item.content}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-none shadow-sm">
          <CardHeader className="bg-muted/30 pb-3">
            <div className="flex items-center gap-2">
              <RefreshCcw className="w-5 h-5 text-orange-500" />
              <CardTitle className="text-lg">Refund Policy</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Last Updated: March 2026</p>
          </CardHeader>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground mb-4">
              This Refund Policy explains the conditions under which refunds may be issued for transactions made through Izichanj.
            </p>
            <Accordion type="single" collapsible className="w-full">
              {refundPolicy.map((item, idx) => (
                <AccordionItem key={idx} value={`refund-${idx}`} className="border-none">
                  <AccordionTrigger className="text-left hover:no-underline font-medium text-sm py-3 px-2 rounded-md hover:bg-muted/50 transition-colors">
                    {item.title}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-sm px-2 pt-1 pb-3 leading-relaxed whitespace-pre-line">
                    {item.content}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
