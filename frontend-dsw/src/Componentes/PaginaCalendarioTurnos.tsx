import { estadosTurno } from '../Tipos/dominio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Chip, Container, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import EncabezadoPagina from './EncabezadoPagina';
import CalendarioTurnosReservados from './CalendarioTurnosReservados';
import { api, type ApiResponse } from '../Servicios/api';
import { cancelarTurno, marcarTurnoAsistido, marcarTurnoNoAsistido } from '../Servicios/turnosService';
import { getMotivosCancelacion } from '../Servicios/motivoCancelacionService';
import type { EstadoTurno, MotivoCancelacion, Turno, TurnoParaDoctor } from '../Tipos/dominio';

const fecha = (s: string) => new Intl.DateTimeFormat('es-AR', { dateStyle: 'full', timeStyle: 'short', timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date(s));
export default function PaginaCalendarioTurnos({ medico = false }: { medico?: boolean }) {
  const [params] = useSearchParams();
  const [estado, setEstado] = useState<EstadoTurno | 'todos'>(medico || params.get('pendientes') === '1' ? 'pendiente' : 'todos');
  const [rango, setRango] = useState({ desde: '', hasta: '' });
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [seleccionado, setSeleccionado] = useState<TurnoParaDoctor | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [accion, setAccion] = useState<'cancelar' | 'asistio' | 'no-asistio' | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [motivos, setMotivos] = useState<MotivoCancelacion[]>([]);
  const [motivoId, setMotivoId] = useState('');
  const [motivo, setMotivo] = useState('');
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setAhora(Date.now()), 30000); return () => clearInterval(timer); }, []);
  useEffect(() => { if (!medico) getMotivosCancelacion().then(setMotivos).catch(() => {}); }, [medico]);
  const rangoActual = useRef('');
  const cambiarRango = useCallback((nuevo: typeof rango) => {
    const clave = nuevo.desde + nuevo.hasta;
    if (rangoActual.current === clave) return;
    rangoActual.current = clave;
    setCargando(true); setError(''); setTurnos([]); setRango(nuevo);
  }, []);
  const refrescar = () => { setCargando(true); setSeleccionado(null); setError(''); setRevision(v => v + 1); };
  useEffect(() => {
    if (!rango.desde) return;
    let vigente = true;
    const query = new URLSearchParams(rango);
    api.get<ApiResponse<Turno[]>>(`/turnos/${medico ? 'atiendo' : 'mios'}?${query}`)
      .then(r => { if (vigente) setTurnos(r.data); })
      .catch(e => { if (vigente) setError(String(e.message)); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [rango, medico, revision]);
  const seleccionar = async (turno: Turno) => {
    setError(''); setOcupado(true);
    try { setSeleccionado((await api.get<ApiResponse<TurnoParaDoctor>>(`/turnos/${turno.id}`)).data); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo consultar el turno'); }
    finally { setOcupado(false); }
  };
  const confirmar = async () => {
    if (!seleccionado || !accion) return;
    setOcupado(true); setError('');
    try {
      if (accion === 'cancelar') await cancelarTurno(seleccionado.id, motivo, motivoId ? Number(motivoId) : null);
      else if (accion === 'asistio') await marcarTurnoAsistido(seleccionado.id);
      else await marcarTurnoNoAsistido(seleccionado.id);
      setAccion(null); refrescar();
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo actualizar el turno'); }
    finally { setOcupado(false); }
  };
  const inicio = seleccionado ? +new Date(seleccionado.fechaHoraTurno) : 0;
  const visibles = turnos.filter(t => estado === 'todos' || t.estado === estado);
  return <Container maxWidth="xl" sx={{ py: 3 }}>
    <EncabezadoPagina><Typography variant="h4" component="h1">{medico ? 'Turnos a atender' : 'Mis turnos'}</Typography>
      <Typography color="text.secondary">{medico ? 'Consultá tus pacientes y registrá la atención.' : 'Consultá tus próximas consultas y tu historial.'} Horarios de Argentina.</Typography></EncabezadoPagina>
    <Stack direction="row" spacing={2} sx={{ my: 3 }}><TextField select label="Estado" value={estado} onChange={e => { setEstado(e.target.value as typeof estado); setSeleccionado(null); }} sx={{ minWidth: 190 }}>
      <MenuItem value="todos">Todos</MenuItem>{Object.entries(estadosTurno).map(([valor, texto]) => <MenuItem key={valor} value={valor}>{texto}</MenuItem>)}</TextField>
      <Button onClick={refrescar} disabled={cargando || ocupado}>Actualizar</Button></Stack>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    {(cargando || ocupado) && <LinearProgress aria-label="Cargando turnos" />}
    <Paper variant="outlined" sx={{ p: { xs: 1, md: 3 } }}>
      <CalendarioTurnosReservados turnos={visibles} medico={medico} onRango={cambiarRango} onSeleccionar={t => { if (!ocupado) void seleccionar(t); }} />
      {!cargando && !visibles.length && <Alert severity="info" sx={{ mt: 2 }}>No hay turnos en este período con el estado seleccionado.</Alert>}
    </Paper>
    <Dialog open={!!seleccionado} onClose={() => { if (!ocupado) { setSeleccionado(null); setAccion(null); } }} fullWidth maxWidth="sm">
      <DialogTitle>{accion ? 'Confirmar acción' : 'Detalle del turno'}</DialogTitle>
      <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
        {error && <Alert severity="error">{error}</Alert>}
        {seleccionado && <>
          <Typography variant="h6">{medico ? `${seleccionado.paciente?.nombre ?? ''} ${seleccionado.paciente?.apellido ?? ''}` : `Dr./Dra. ${seleccionado.doctor.nombre} ${seleccionado.doctor.apellido}`}</Typography>
          <Typography>{fecha(seleccionado.fechaHoraTurno)}</Typography>
          <Typography>{seleccionado.duracionTurnoMinutos ? `Duración: ${seleccionado.duracionTurnoMinutos} minutos` : 'Duración histórica pendiente de verificar'}</Typography>
          <Typography>{seleccionado.doctor.especialidades?.map(e => e.descripcionEsp).join(' · ')}</Typography>
          <Typography>Obra social: {seleccionado.obraSocial?.nombre ?? 'Sin obra social'}</Typography>
          {medico && <Typography>DNI: {seleccionado.paciente?.dni ?? 'No informado'}</Typography>}
          <Chip label={estadosTurno[seleccionado.estado]} sx={{ alignSelf: 'start' }} />
          {seleccionado.motivoCancelacion && <Alert severity="info">{seleccionado.motivoCancelacion}</Alert>}
          {accion === 'cancelar' && <><TextField select label="Motivo (opcional)" value={motivoId} onChange={e => setMotivoId(e.target.value)}><MenuItem value="">Sin motivo</MenuItem>{motivos.map(m => <MenuItem key={m.id} value={m.id}>{m.descripcion}</MenuItem>)}</TextField><TextField multiline label="Otro motivo (opcional)" value={motivo} onChange={e => setMotivo(e.target.value)} /></>}
          {accion && <Typography>{accion === 'cancelar' ? '¿Confirmás la cancelación? Se liberará el horario si la agenda actual lo ofrece.' : '¿Confirmás el cambio de estado de este turno?'}</Typography>}
          {!accion && medico && seleccionado.estado === 'pendiente' && <Typography variant="body2">Asistencia: desde el inicio hasta 15 minutos después. Inasistencia: desde el horario del turno.</Typography>}
        </>}
      </Stack></DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
        <Button disabled={ocupado} onClick={() => accion ? setAccion(null) : setSeleccionado(null)}>{accion ? 'Volver' : 'Cerrar'}</Button>
        {accion ? <Button disabled={ocupado} variant="contained" onClick={confirmar}>Confirmar {accion === 'cancelar' ? 'cancelación' : 'estado'}</Button> : seleccionado?.estado === 'pendiente' && (medico ? <>
          <Button color="success" disabled={ocupado || ahora < inicio || ahora > inicio + 15 * 60000} onClick={() => setAccion('asistio')}>Marcar asistencia</Button>
          <Button color="warning" disabled={ocupado || ahora < inicio} onClick={() => setAccion('no-asistio')}>Marcar inasistencia</Button>
        </> : <Button color="error" disabled={ocupado || ahora >= inicio} onClick={() => { setMotivo(''); setMotivoId(''); setAccion('cancelar'); }}>Cancelar turno</Button>)}
      </DialogActions>
    </Dialog>
  </Container>;
}
