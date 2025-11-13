import { Metadata } from "next";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Metodoloji",
  description: "Casper Ignite üzerinde tokenize girişimlerin nasıl modellendiğini anlatır.",
};

const steps = [
  {
    title: "1. Proje Tanımı",
    detail:
      "Kurucu, başlık, detaylı açıklama ve token parametrelerini (simge, toplam arz, sahiplik yüzdesi) girer.",
  },
  {
    title: "2. Token İhracı",
    detail:
      "Portal, Casper RPC üzerinden CEP-18 contract deploy işlemini tetikler ve proje ile eşler.",
  },
  {
    title: "3. Piyasa Verisi",
    detail:
      "Alım/satım emirleri ProjectOrder tablosuna kaydedilir; metrik servisi fiyat, market cap ve likiditeyi günceller.",
  },
  {
    title: "4. Yatırımcı Şeffaflığı",
    detail:
      "Her proje sayfası arz, sahiplik yüzdesi, kurucu adresi ve emir defterini aynı ekranda sunar.",
  },
];

export default function MethodologyPage() {
  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm uppercase tracking-wide text-muted-foreground">
          Casper Ignite · Metodoloji
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Tokenize Girişimler Nasıl Çalışır?</h1>
        <p className="mt-2 text-muted-foreground">
          Ignite, geleneksel hisse dilimini CEP-18 token ile temsil eder. Aşağıdaki adımlar, portalın
          uçtan uca süreçlerini özetler.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        {steps.map((step) => (
          <Card key={step.title} className="border-4 border-brand-100 bg-white/90 shadow-cartoon-pop">
            <CardHeader>
              <p className="text-sm font-semibold text-brand-700">{step.title}</p>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-brand-700">{step.detail}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section>
        <Card className="border-4 border-brand-100 bg-white/90 shadow-cartoon-pop">
          <CardHeader>
            <p className="font-semibold text-brand-800">Etik Notlar</p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-brand-700">
            <p>
              Ignite’de listelenen tokenlar, menkul kıymet temsil eden deneysel ürünlerdir. Her
              kurucu, yasal çerçeve ve yatırımcı uygunluğundan sorumludur.
            </p>
            <p>
              Portal hiçbir zaman koordineli alım/satım çağrısı yapmaz; metrikler bilgi amaçlıdır ve
              yatırım tavsiyesi değildir.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
