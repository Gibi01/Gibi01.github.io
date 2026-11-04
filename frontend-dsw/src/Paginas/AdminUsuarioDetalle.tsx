import { useCallback, useEffect, useRef, useState } from 'react';
import { Link as RouterLink, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, Chip, Container, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, MenuItem, Paper, Stack, Tab, Tabs, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import EncabezadoPagina from '../Componentes/EncabezadoPagina';
import CalendarioTurnosReservados from '../Componentes/CalendarioTurnosReservados';
import { getPerfilAdmin, getHistorialAdmin, type UsuarioDetalleAdmin } from '../Servicios/usuariosService';
import { estadosTurno, type TurnoParaDoctor } from '../Tipos/dominio';

const roles: Record<string, string> = { doctor: 'Médico', paciente: 'Paciente', admin: 'Administrador' };
const fecha = (s: string) => new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(s));
const color = (estado: string) => estado === 'pendiente' ? 'info' : estado === 'asistido' ? 'success' : estado === 'no_asistido' ? 'warning' : 'default';

export default function AdminUsuarioDetalle() {
  const { id = '' } = useParams();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'turnos' ? 'turnos' : 'perfil';
  const [usuario, setUsuario] = useState<UsuarioDetalleAdmin | null>(null);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);
  const retorno = typeof location.state?.busquedaUsuarios === 'string' ? location.state.busquedaUsuarios : '';
  useEffect(() => {
    let vigente = true;
    getPerfilAdmin(id).then(u => { if (vigente) setUsuario(u); }).catch(e => { if (vigente) setError(e.message); });
    return () => { vigente = false; };
  }, [id, intento]);
  const cambiarTab = (valor: string) => setParams({ tab: valor }, { replace: true, state: location.state });
  return <Container maxWidth="lg" sx={{ py: 3 }}>
    <Button component={RouterLink} to={`/admin/usuarios${retorno}`} sx={{ mb: 2 }}>← Volver a usuarios</Button>
    {error ? <Alert severity="error" action={<Button onClick={() => { setError(''); setIntento(i => i + 1); }}>Reintentar</Button>}>{error}</Alert>
      : !usuario ? <LinearProgress aria-label="Cargando perfil" /> : <>
        <EncabezadoPagina><Typography component="h1" variant="h4">{usuario.nombre} {usuario.apellido}</Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 2 }}><Chip label={roles[usuario.rol] ?? usuario.rol} /><Chip label={usuario.activo ? 'Activo' : 'Dado de baja'} color={usuario.activo ? 'success' : 'default'} /></Stack>
        </EncabezadoPagina>
        <Tabs value={tab} onChange={(_, valor) => cambiarTab(valor)} sx={{ mb: 3 }}><Tab value="perfil" label="Perfil" /><Tab value="turnos" label="Turnos" /></Tabs>
        {tab === 'perfil' ? <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography component="h2" variant="h6" sx={{ mb: 2 }}>Datos del usuario</Typography>
          <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            {Object.entries({ DNI: usuario.dni, Email: usuario.email, Teléfono: usuario.telefonoCelular, Dirección: usuario.direccion, 'Fecha de alta': usuario.fechaAlta ? fecha(usuario.fechaAlta) : null,
              ...(usuario.doctor ? { Matrícula: String(usuario.doctor.matricula), Especialidades: usuario.doctor.especialidades.map(e => e.descripcionEsp).join(', ') } : {}) }).map(([label, valor]) => <Box key={label} sx={{ borderBottom: 1, borderColor: 'divider', pb: 2 }}><Typography component="dt" color="text.secondary">{label}</Typography><Typography component="dd" sx={{ m: 0, overflowWrap: 'anywhere' }}>{valor || 'Sin registro'}</Typography></Box>)}
          </Box>
          <Button variant="outlined" sx={{ mt: 3 }} onClick={() => cambiarTab('turnos')}>Ver historial de turnos</Button>
        </Paper> : <Historial key={usuario.id} usuario={usuario} />}
      </>}
  </Container>;
}

function Historial({ usuario }: { usuario: UsuarioDetalleAdmin }) {
  const [perspectiva, setPerspectiva] = useState('paciente');
  const [vista, setVista] = useState('listado');
  const [estado, setEstado] = useState('todos');
  const [periodo, setPeriodo] = useState('todos');
  const [pagina, setPagina] = useState(0);
  const [rango, setRango] = useState({ desde: '', hasta: '' });
  const [datos, setDatos] = useState<{ total: number; turnos: TurnoParaDoctor[] }>({ total: 0, turnos: [] });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);
  const [seleccionado, setSeleccionado] = useState<TurnoParaDoctor | null>(null);
  const rangoActual = useRef('');
  const onRango = useCallback((nuevo: typeof rango) => {
    const clave = nuevo.desde + nuevo.hasta;
    if (rangoActual.current === clave) return;
    rangoActual.current = clave;
    setCargando(true); setError(''); setDatos({ total: 0, turnos: [] }); setRango(nuevo);
  }, []);
  const cambiar = (setter: (v: string) => void, v: string) => { setter(v); setPagina(0); setCargando(true); setDatos({ total: 0, turnos: [] }); setError(''); setSeleccionado(null); };
  useEffect(() => {
    if (vista === 'calendario' && !rango.desde) return;
    let vigente = true;
    const query = new URLSearchParams({ perspectiva, vista, estado, periodo, pagina: String(pagina) });
    if (vista === 'calendario') { query.set('desde', rango.desde); query.set('hasta', rango.hasta); }
    getHistorialAdmin(usuario.id, query).then(d => { if (vigente) setDatos(d); })
      .catch(e => { if (vigente) setError(e.message); }).finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [usuario.id, perspectiva, vista, estado, periodo, pagina, rango, intento]);
  const profesional = perspectiva === 'profesional';
  const nombre = (t: TurnoParaDoctor) => profesional ? `${t.paciente.nombre} ${t.paciente.apellido}` : `Dr./Dra. ${t.doctor.nombre} ${t.doctor.apellido}`;
  return <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
    <Typography component="h2" variant="h6" sx={{ mb: 2 }}>Historial de turnos</Typography>
    {usuario.doctor && <Tabs value={perspectiva} onChange={(_, v) => cambiar(setPerspectiva, v)} sx={{ mb: 2 }}><Tab value="paciente" label="Como paciente" /><Tab value="profesional" label="Como profesional" /></Tabs>}
    <Stack spacing={2} sx={{ mb: 2 }}>
      <ToggleButtonGroup value={vista} exclusive onChange={(_, v) => { if (v) cambiar(setVista, v); }} aria-label="Vista del historial"><ToggleButton value="listado">Listado</ToggleButton><ToggleButton value="calendario">Calendario</ToggleButton></ToggleButtonGroup>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
        <TextField select label="Estado" value={estado} onChange={e => cambiar(setEstado, e.target.value)}><MenuItem value="todos">Todos</MenuItem>{Object.entries(estadosTurno).map(([v, n]) => <MenuItem key={v} value={v}>{n}</MenuItem>)}</TextField>
        <TextField select label="Período" value={periodo} onChange={e => cambiar(setPeriodo, e.target.value)}><MenuItem value="todos">Todos</MenuItem><MenuItem value="proximos">Próximos</MenuItem><MenuItem value="pasados">Pasados</MenuItem></TextField>
      </Box>
    </Stack>
    {cargando && <LinearProgress aria-label="Cargando historial" />}
    {error && <Alert severity="error" action={<Button onClick={() => { setError(''); setCargando(true); setIntento(i => i + 1); }}>Reintentar</Button>}>{error}</Alert>}
    {vista === 'calendario' ? <CalendarioTurnosReservados turnos={datos.turnos} medico={profesional} onRango={onRango} onSeleccionar={t => setSeleccionado(t as TurnoParaDoctor)} /> : <>
      <TableContainer sx={{ display: { xs: 'none', md: 'block' } }}><Table aria-label="Historial de turnos"><TableHead><TableRow>{['Fecha y hora', profesional ? 'Paciente' : 'Profesional', 'Especialidad', 'Estado', 'Acciones'].map(t => <TableCell key={t}>{t}</TableCell>)}</TableRow></TableHead>
        <TableBody>{datos.turnos.map(t => <TableRow key={t.id}><TableCell>{fecha(t.fechaHoraTurno)}</TableCell><TableCell>{nombre(t)}</TableCell><TableCell>{t.doctor.especialidades?.map(e => e.descripcionEsp).join(', ')}</TableCell><TableCell><Chip size="small" color={color(t.estado)} label={estadosTurno[t.estado]} /></TableCell><TableCell><Button onClick={() => setSeleccionado(t)}>Ver detalle</Button></TableCell></TableRow>)}</TableBody></Table></TableContainer>
      <Stack spacing={2} sx={{ display: { xs: 'flex', md: 'none' }, mt: 2 }}>{datos.turnos.map(t => <Paper variant="outlined" key={t.id} sx={{ p: 2 }}><Typography sx={{ fontWeight: 700 }}>{fecha(t.fechaHoraTurno)}</Typography><Chip sx={{ my: 1 }} size="small" color={color(t.estado)} label={estadosTurno[t.estado]} /><Typography>{nombre(t)}</Typography><Typography color="text.secondary">{t.doctor.especialidades?.map(e => e.descripcionEsp).join(', ')}</Typography><Button fullWidth variant="outlined" sx={{ mt: 1 }} onClick={() => setSeleccionado(t)}>Ver detalle</Button></Paper>)}</Stack>
      <TablePagination component="div" count={datos.total} page={pagina} rowsPerPage={10} rowsPerPageOptions={[]} onPageChange={(_, p) => { setPagina(p); setCargando(true); }} labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`} getItemAriaLabel={t => t === 'next' ? 'Página siguiente' : 'Página anterior'} />
    </>}
    {!cargando && !error && !datos.turnos.length && <Alert severity="info">No hay turnos para los filtros seleccionados.</Alert>}
    <Typography variant="caption" color="text.secondary">Horarios de Argentina · Consulta de solo lectura</Typography>
    <Dialog open={!!seleccionado} onClose={() => setSeleccionado(null)} fullWidth maxWidth="sm"><DialogTitle>Detalle del turno</DialogTitle><DialogContent>{seleccionado && <Stack spacing={2} sx={{ pt: 1 }}>
      <Typography>{fecha(seleccionado.fechaHoraTurno)}</Typography><Typography>Paciente: {seleccionado.paciente.nombre} {seleccionado.paciente.apellido}</Typography><Typography>Profesional: {seleccionado.doctor.nombre} {seleccionado.doctor.apellido}</Typography>
      <Typography>Duración: {seleccionado.duracionTurnoMinutos ? `${seleccionado.duracionTurnoMinutos} minutos` : 'Sin registro'}</Typography><Typography>Obra social: {seleccionado.obraSocial?.nombre ?? 'Sin obra social'}</Typography>
      <Typography>Estado: {estadosTurno[seleccionado.estado]}</Typography><Typography>Reservado: {fecha(seleccionado.fechaHoraEmision)}</Typography>
      {seleccionado.fechaHoraCancelacion && <Typography>Cancelado: {fecha(seleccionado.fechaHoraCancelacion)}</Typography>}
      {(seleccionado.motivoCancelacion || seleccionado.motivoCancelacionPreestablecido) && <Alert severity="info">Motivo: {[seleccionado.motivoCancelacionPreestablecido?.descripcion, seleccionado.motivoCancelacion].filter(Boolean).join(' · ')}</Alert>}
    </Stack>}</DialogContent><DialogActions><Button onClick={() => setSeleccionado(null)}>Cerrar</Button></DialogActions></Dialog>
  </Paper>;
}
