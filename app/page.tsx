import Image from "next/image";

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="text-center py-8">
        <h1 className="text-4xl font-semibold tracking-tight">Flaks</h1>
        <p className="text-white/70 mt-2">El prospecto de cada día</p>
        <div className="mt-4 flex justify-center gap-3">
          <a className="btn" href="/login">Empezar</a>
          <a className="btn-outline" href="/dashboard">Ver demo</a>
        </div>
      </section>
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card href="/upload" title="Cargar base" desc="Subí .xlsx o .csv y generá tu base total." img="/illustrations/upload.svg" />
        <Card href="/plan" title="Plan diario" desc="Distribuí 25/día por cuenta en un click." img="/illustrations/plan.svg" />
        <Card href="/dashboard" title="Dashboard" desc="Seguimiento de conversiones, CPA y CPR." img="/illustrations/dashboard.svg" />
        <Card href="/prospects" title="Base" desc="Filtrá, deduplicá y previsualizá perfiles." img="/illustrations/base.svg" />
      </section>
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
        <div className="card p-6 lg:col-span-2">
          <h2 className="text-xl font-semibold mb-2">¿Qué resuelve Flaks?</h2>
          <ul className="list-disc list-inside text-white/80 space-y-1">
            <li>Centraliza tus prospectos desde Excel/CSV con limpieza automática.</li>
            <li>Planifica envíos diarios por cuenta y marca el progreso.</li>
            <li>Mide tiempo y costo: CPA por mensaje y CPR por cliente.</li>
          </ul>
          <div className="mt-4"><a className="btn" href="/login">Empezar ahora</a></div>
        </div>
        <div className="card p-6">
          <h3 className="font-semibold mb-2">Cómo funciona</h3>
          <ol className="space-y-2 text-white/80">
            <li><span className="text-white">1.</span> Cargá tu archivo y limpiamos duplicados.</li>
            <li><span className="text-white">2.</span> Generá el plan diario (25/día por cuenta).</li>
            <li><span className="text-white">3.</span> Marcá enviados/ganados y medí tu tiempo.</li>
          </ol>
        </div>
      </section>
    </div>
  );
}

function Card({ href, title, desc, img }: { href: string, title: string, desc: string, img: string }) {
  return (
    <a href={href} className="card p-6 hover:scale-[1.02] transition block">
      <div className="flex flex-col items-start gap-4">
        <div className="w-24 h-24 relative">
          <Image src={img} alt="" fill sizes="96px" />
        </div>
        <div>
          <div className="text-lg font-semibold">{title}</div>
          <div className="text-sm text-white/70">{desc}</div>
        </div>
      </div>
    </a>
  );
}

