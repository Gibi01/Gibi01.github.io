import { useEffect, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import luxonPlugin from '@fullcalendar/luxon3';
import esLocale from '@fullcalendar/core/locales/es';
import type { EventApi } from '@fullcalendar/core';
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, LinearProgress, MenuItem, Paper, Stack, TextField, Typography, useMediaQuery, useTheme } from '@mui/material';
import { completarDuracion, guardarSemana, obtenerSemana, revisarSemana, type BloqueAgenda, type ImpactoAgenda, type SemanaAgenda } from '../Servicios/agendaService';
import './calendario.css';

const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const nuevo: BloqueAgenda = { diaSemana: 1, horaInicio: '08:00', horaFin: '12:00', duracionTurnoMinutos: 30, terminaDiaSiguiente: false };
const minutos = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
const local = (d: Date) => new Date(+d - 3 * 3600000);
const hora = (d: Date) => local(d).toISOString().slice(11, 16);
const fecha = (s: string) => new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date(s));

export default function EditorAgenda({ doctorId, onDirty }: { doctorId: number; onDirty?: (dirty: boolean) => void }) {
  const [semana, setSemana] = useState<SemanaAgenda | null>(null);
  const [bloques, setBloques] = useState<BloqueAgenda[]>([]);
  const [dirty, setDirty] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [edicion, setEdicion] = useState<{ indice: number; bloque: BloqueAgenda } | null>(null);
  const [impacto, setImpacto] = useState<ImpactoAgenda | null>(null);
  const [acepta, setAcepta] = useState(false);
  const [historicas, setHistoricas] = useState<Record<number, string>>({});
  const [dia, setDia] = useState(1);
  const movil = useMediaQuery(useTheme().breakpoints.down('sm'));
  const calendario = useRef<FullCalendar>(null);
  const cargar = async () => {
    setCargando(true); setError('');
    try { const data = await obtenerSemana(doctorId); setSemana(data); setBloques(data.bloques); setDirty(false); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar la agenda'); }
    finally { setCargando(false); }
  };
  useEffect(() => {
    let vigente = true;
    obtenerSemana(doctorId).then(data => { if (vigente) { setSemana(data); setBloques(data.bloques); } })
      .catch(e => { if (vigente) setError(e.message); }).finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [doctorId]);
  useEffect(() => { onDirty?.(dirty); }, [dirty, onDirty]);
  useEffect(() => {
    if (!dirty) return;
    const avisar = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', avisar);
    // BrowserRouter no dispone del bloqueador de navegación de los data routers.
    const navegar = (e: MouseEvent) => {
      const enlace = (e.target as HTMLElement).closest('a[href]');
      if (enlace && !window.confirm('Hay cambios de agenda sin guardar. ¿Querés descartarlos y salir?')) { e.preventDefault(); e.stopPropagation(); }
    };
    document.addEventListener('click', navegar, true);
    return () => { window.removeEventListener('beforeunload', avisar); document.removeEventListener('click', navegar, true); };
  }, [dirty]);
  useEffect(() => { calendario.current?.getApi().changeView(movil ? 'timeGridDay' : 'timeGridWeek'); }, [movil]);
  const cambiar = (lista: BloqueAgenda[]) => { setBloques(lista); setDirty(true); setImpacto(null); setAviso(''); };
  const aplicarBloque = () => {
    if (!edicion) return;
    const b = edicion.bloque;
    const total = minutos(b.horaFin) + (b.terminaDiaSiguiente ? 1440 : 0) - minutos(b.horaInicio);
    if (!b.horaInicio || !b.horaFin || total <= 0 || total > 1440 || !Number.isInteger(b.duracionTurnoMinutos) || b.duracionTurnoMinutos <= 0 || total % b.duracionTurnoMinutos) { setError('Indicá un bloque de hasta 24 horas que contenga turnos completos.'); return; }
    cambiar(edicion.indice < 0 ? [...bloques, b] : bloques.map((v, i) => i === edicion.indice ? b : v)); setEdicion(null); setError('');
  };
  const desdeFechas = (inicio: Date, fin: Date, duracion = 30): BloqueAgenda => ({ diaSemana: local(inicio).getUTCDay(), horaInicio: hora(inicio), horaFin: hora(fin), terminaDiaSiguiente: local(inicio).toISOString().slice(0, 10) !== local(fin).toISOString().slice(0, 10), duracionTurnoMinutos: duracion });
  const mover = (event: EventApi, revert: () => void) => {
    const indice = Number(event.extendedProps.indice);
    if (event.start && event.end) setEdicion({ indice, bloque: desdeFechas(event.start, event.end, bloques[indice].duracionTurnoMinutos) });
    revert();
  };
  const eventos = bloques.flatMap((b, indice) => {
    const offsets = b.diaSemana === 0 ? [0, 7] : [b.diaSemana];
    return offsets.map(offset => {
      const inicio = new Date(Date.UTC(2026, 10, 1 + offset, 3) + minutos(b.horaInicio) * 60000);
      const fin = new Date(Date.UTC(2026, 10, 1 + offset, 3) + (minutos(b.horaFin) + (b.terminaDiaSiguiente ? 1440 : 0)) * 60000);
      return { id: `${indice}-${offset}`, start: inicio.toISOString(), end: fin.toISOString(), title: `Turnos de ${b.duracionTurnoMinutos} min${b.terminaDiaSiguiente ? ' · hasta el día siguiente' : ''}`, extendedProps: { indice }, backgroundColor: '#FAF5E6', textColor: '#6F5100', borderColor: '#8D6700' };
    });
  });
  const revisar = async () => {
    if (!semana) return;
    setCargando(true); setError('');
    try { setImpacto(await revisarSemana(doctorId, semana.version, bloques)); setAcepta(false); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo revisar la agenda'); }
    finally { setCargando(false); }
  };
  const guardar = async () => {
    if (!semana || !impacto) return;
    setCargando(true); setError('');
    try {
      await guardarSemana(doctorId, semana.version, bloques, impacto.token, acepta);
      setImpacto(null); await cargar(); setAviso('Agenda guardada. Los turnos anteriores conservan su horario y duración.');
    } catch (e) { setImpacto(null); setError(`${e instanceof Error ? e.message : 'No se pudo guardar'}. Si hubo un error de conexión, recargá para verificar el estado antes de reintentar.`); }
    finally { setCargando(false); }
  };
  return <Stack spacing={2}>
    <Alert severity="info">Plantilla semanal: los bloques se repiten cada semana. Los turnos ya reservados conservan su horario y duración. Horarios de Argentina.</Alert>
    {error && <Alert severity="error">{error}</Alert>}{aviso && <Alert severity="success">{aviso}</Alert>}
    {semana && !semana.activo && <Alert severity="warning">El profesional está dado de baja. Su agenda no admite nuevas reservas ni cambios.</Alert>}
    {semana?.sinDuracion.map(t => <Paper variant="outlined" key={t.id} sx={{ p: 2 }}><Stack spacing={1}>
      <Typography>Verificá la duración pactada del turno #{t.id}: {fecha(t.fechaHoraTurno)}.</Typography>
      <TextField type="number" label={`Duración del turno ${t.id} (min)`} value={historicas[t.id] ?? ''} onChange={e => setHistoricas(v => ({ ...v, [t.id]: e.target.value }))} />
      <Button disabled={cargando || !historicas[t.id]} onClick={async () => { setCargando(true); try { await completarDuracion(doctorId, t.id, Number(historicas[t.id])); await cargar(); } catch (e) { setError(String(e)); } finally { setCargando(false); } }}>Registrar duración verificada</Button>
    </Stack></Paper>)}
    <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
      <Button variant="contained" disabled={cargando || !semana?.activo || !!semana.sinDuracion.length} onClick={() => { setError(''); setEdicion({ indice: -1, bloque: { ...nuevo, diaSemana: dia } }); }}>Agregar bloque</Button>
      <Button disabled={cargando || !semana?.activo} onClick={() => { if (window.confirm('¿Vaciar el borrador semanal? Los turnos reservados se conservarán.')) cambiar([]); }}>Vaciar semana</Button>
      <Button disabled={cargando} onClick={() => { if (!dirty || window.confirm('¿Descartar los cambios sin guardar y recargar?')) void cargar(); }}>Recargar / descartar</Button>
      <Button variant="contained" disabled={!dirty || cargando || !semana?.activo} onClick={revisar}>Revisar y guardar semana</Button>
    </Stack>
    {dirty && <Alert severity="warning">Cambios sin guardar. Aplicá los bloques al borrador y luego revisá la semana para confirmarla.</Alert>}
    {cargando && <LinearProgress />}
    {movil && <TextField select label="Día" value={dia} onChange={e => { const d = Number(e.target.value); setDia(d); calendario.current?.getApi().gotoDate(`2026-11-${String(d === 0 ? 8 : d + 1).padStart(2, '0')}`); }}>{dias.map((d, i) => <MenuItem key={d} value={i}>{d}</MenuItem>)}</TextField>}
    <Paper variant="outlined" sx={{ p: { xs: 1, md: 2 } }} className="calendario">
      <Typography variant="h6" sx={{ mb: 2 }}>Horario semanal</Typography>
      <FullCalendar ref={calendario} plugins={[timeGridPlugin, interactionPlugin, luxonPlugin]} locale={esLocale} timeZone="America/Argentina/Buenos_Aires"
        initialDate="2026-11-02" initialView={movil ? 'timeGridDay' : 'timeGridWeek'} firstDay={1} headerToolbar={false} dayHeaderFormat={{ weekday: 'long' }}
        allDaySlot={false} slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }} height={620} scrollTime="08:00:00" slotMinTime="00:00:00" slotMaxTime="24:00:00" slotDuration="00:30:00" snapDuration="00:15:00"
        editable={!cargando && !!semana?.activo && !semana.sinDuracion.length} selectable={!cargando && !!semana?.activo && !semana.sinDuracion.length}
        eventResizableFromStart eventInteractive events={eventos}
        select={info => { setEdicion({ indice: -1, bloque: desdeFechas(info.start, info.end) }); calendario.current?.getApi().unselect(); }}
        eventClick={({ event }) => { if (!cargando && semana?.activo) { const indice = Number(event.extendedProps.indice); setEdicion({ indice, bloque: { ...bloques[indice] } }); } }}
        eventDrop={info => mover(info.event, info.revert)} eventResize={info => mover(info.event, info.revert)} />
      <Typography variant="body2" sx={{ mt: 2 }}>Arrastrá para mover, estirá los bordes o seleccioná un bloque para editarlo. También podés usar los botones de abajo.</Typography>
      <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', mt: 1 }}>{bloques.map((b, i) => <Button key={i} disabled={cargando || !semana?.activo} onClick={() => setEdicion({ indice: i, bloque: { ...b } })}>{dias[b.diaSemana]} {b.horaInicio}–{b.horaFin}{b.terminaDiaSiguiente ? ' (+1 día)' : ''}</Button>)}</Stack>
    </Paper>
    <Dialog open={!!edicion} onClose={() => setEdicion(null)} fullWidth maxWidth="sm"><DialogTitle>{edicion?.indice === -1 ? 'Agregar bloque' : 'Editar bloque'}</DialogTitle>
      <DialogContent>{edicion && <Stack spacing={2} sx={{ pt: 1 }}>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField select label="Día de inicio" value={edicion.bloque.diaSemana} onChange={e => setEdicion({ ...edicion, bloque: { ...edicion.bloque, diaSemana: Number(e.target.value) } })}>{dias.map((d, i) => <MenuItem key={d} value={i}>{d}</MenuItem>)}</TextField>
        <TextField type="time" label="Inicio" slotProps={{ inputLabel: { shrink: true } }} value={edicion.bloque.horaInicio} onChange={e => setEdicion({ ...edicion, bloque: { ...edicion.bloque, horaInicio: e.target.value } })} />
        <TextField type="time" label="Fin" slotProps={{ inputLabel: { shrink: true } }} value={edicion.bloque.horaFin} onChange={e => setEdicion({ ...edicion, bloque: { ...edicion.bloque, horaFin: e.target.value } })} />
        <FormControlLabel label="Finaliza al día siguiente" control={<Checkbox checked={!!edicion.bloque.terminaDiaSiguiente} onChange={(_, checked) => setEdicion({ ...edicion, bloque: { ...edicion.bloque, terminaDiaSiguiente: checked } })} />} />
        <TextField type="number" label="Duración del turno (minutos)" value={edicion.bloque.duracionTurnoMinutos} onChange={e => setEdicion({ ...edicion, bloque: { ...edicion.bloque, duracionTurnoMinutos: Number(e.target.value) } })} />
      </Stack>}</DialogContent><DialogActions sx={{ flexWrap: 'wrap' }}>
        {edicion && edicion.indice >= 0 && <Button color="error" onClick={() => { cambiar(bloques.filter((_, i) => i !== edicion.indice)); setEdicion(null); }}>Eliminar del borrador</Button>}
        <Button onClick={() => setEdicion(null)}>Cancelar</Button><Button variant="contained" onClick={aplicarBloque}>Aplicar al borrador</Button>
      </DialogActions></Dialog>
    <Dialog open={!!impacto} onClose={() => { if (!cargando) setImpacto(null); }} fullWidth maxWidth="sm"><DialogTitle>Confirmar nueva agenda</DialogTitle><DialogContent>
      <Typography sx={{ mb: 2 }}>{bloques.length} bloques semanales. Se aplicarán a nuevas reservas; las anteriores no cambian.</Typography>
      {!bloques.length && <Alert severity="warning">No se ofrecerán nuevos horarios.</Alert>}
      {impacto?.excepciones.length ? <><Alert severity="warning">{impacto.excepciones.length} reservas quedan fuera de la nueva plantilla y deben atenderse como se acordó.</Alert><Box component="ul">{impacto.excepciones.map(t => <li key={t.id}>{fecha(t.fechaHoraTurno)} · {t.duracionTurnoMinutos} min</li>)}</Box><FormControlLabel label="Confirmo que se atenderán estas reservas en sus horarios originales" control={<Checkbox checked={acepta} onChange={(_, v) => setAcepta(v)} />} /></> : <Alert severity="success">No hay reservas fuera de la plantilla propuesta.</Alert>}
    </DialogContent><DialogActions><Button disabled={cargando} onClick={() => setImpacto(null)}>Volver</Button><Button variant="contained" disabled={cargando || (!!impacto?.excepciones.length && !acepta)} onClick={guardar}>Confirmar agenda</Button></DialogActions></Dialog>
  </Stack>;
}
