import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Container, MenuItem, Paper, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination, TextField, Typography } from '@mui/material';
import EncabezadoPagina from '../Componentes/EncabezadoPagina';
import { getUsuariosListado, type UsuarioListado } from '../Servicios/usuariosService';

const roles: Record<string, string> = { doctor: 'Médico', paciente: 'Paciente', admin: 'Administrador' };
const normalizar = (valor: string) => valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const fecha = (valor: string | null) => valor ? new Date(valor).toLocaleDateString('es-AR') : 'Sin registro';

export default function AdminUsuarios() {
  const [params, setParams] = useSearchParams();
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [usuarios, setUsuarios] = useState<UsuarioListado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [busqueda, setBusqueda] = useState(params.get('buscar') ?? '');
  const [rol, setRol] = useState(params.get('rol') ?? 'todos');
  const [estado, setEstado] = useState(params.get('estado') ?? 'todos');
  const [orden, setOrden] = useState(params.get('orden') ?? 'recientes');
  const [pagina, setPagina] = useState(() => Math.max(0, Number(params.get('pagina')) || 0));
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vigente = true;
    getUsuariosListado().then(datos => { if (vigente) setUsuarios(datos); })
      .catch(() => { if (vigente) setError(true); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [intento]);

  useEffect(() => {
    const query = new URLSearchParams();
    if (busqueda) query.set('buscar', busqueda);
    if (rol !== 'todos') query.set('rol', rol);
    if (estado !== 'todos') query.set('estado', estado);
    if (orden !== 'recientes') query.set('orden', orden);
    if (pagina) query.set('pagina', String(pagina));
    setParams(query, { replace: true });
  }, [busqueda, rol, estado, orden, pagina, setParams]);
  const acciones = (u: UsuarioListado) => <Stack spacing={1} direction={{ xs: 'column', md: 'row' }}>
    <Button variant="outlined" component={RouterLink} to={`/admin/usuarios/${u.id}?tab=perfil`} state={{ busquedaUsuarios: params.size ? '?' + params.toString() : '' }}>Ver perfil</Button>
    <Button variant="outlined" component={RouterLink} to={`/admin/usuarios/${u.id}?tab=turnos`} state={{ busquedaUsuarios: params.size ? '?' + params.toString() : '' }}>Historial de turnos</Button>
  </Stack>;

  const visibles = usuarios.filter(u =>
    normalizar(`${u.nombre} ${u.apellido}`).includes(normalizar(busqueda)) &&
    (rol === 'todos' || u.rol === rol) &&
    (estado === 'todos' || u.activo === (estado === 'activo'))
  ).sort((a, b) => orden === 'nombre'
    ? `${a.nombre} ${a.apellido}`.localeCompare(`${b.nombre} ${b.apellido}`, 'es') || a.id - b.id
    : (b.fechaAlta ? Date.parse(b.fechaAlta) : 0) - (a.fechaAlta ? Date.parse(a.fechaAlta) : 0) || b.id - a.id);
  const filas = visibles.slice(pagina * 10, pagina * 10 + 10);
  const cambiar = (setter: (valor: string) => void, valor: string) => { setter(valor); setPagina(0); };

  return <Container maxWidth="lg" sx={{ py: 4 }}>
    <EncabezadoPagina>
      <Typography variant="h4" component="h1" gutterBottom>Ver usuarios</Typography>
      <Typography color="text.secondary">Consultá los usuarios del sistema, incluidos los dados de baja.</Typography>
    </EncabezadoPagina>
    <Paper variant="outlined" sx={{ p: 2, my: 3 }}>
      <TextField fullWidth label="Buscar por nombre o apellido" value={busqueda} onChange={e => cambiar(setBusqueda, e.target.value)} />
      <Stack direction="row" spacing={1} sx={{ mt: 2, alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}>
      <Button variant="outlined" aria-expanded={mostrarFiltros} onClick={() => setMostrarFiltros(v => !v)} sx={{ display: { xs: 'inline-flex', md: 'none' }, minHeight: 48 }}>Filtros ({Number(rol !== 'todos') + Number(estado !== 'todos')})</Button>
      <Button sx={{ minHeight: 48 }} onClick={() => { setBusqueda(''); setRol('todos'); setEstado('todos'); setOrden('recientes'); setPagina(0); }} variant="outlined">
        Limpiar filtros
      </Button>
      </Stack>
      <Box sx={{ display: { xs: mostrarFiltros ? 'grid' : 'none', md: 'grid' }, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 2, mt: 2 }}>
        <TextField select label="Rol" value={rol} onChange={e => cambiar(setRol, e.target.value)}>
          <MenuItem value="todos">Todos los roles</MenuItem>
          {Object.entries(roles).map(([id, nombre]) => <MenuItem key={id} value={id}>{nombre}</MenuItem>)}
        </TextField>
        <TextField select label="Estado" value={estado} onChange={e => cambiar(setEstado, e.target.value)}>
          <MenuItem value="todos">Todos los estados</MenuItem><MenuItem value="activo">Activo</MenuItem><MenuItem value="baja">Dado de baja</MenuItem>
        </TextField>
        <TextField select label="Ordenar por" value={orden} onChange={e => cambiar(setOrden, e.target.value)}>
          <MenuItem value="recientes">Más recientes</MenuItem><MenuItem value="nombre">Nombre (A–Z)</MenuItem>
        </TextField>
      </Box>

    </Paper>
    {cargando ? <Box role="status" sx={{ textAlign: 'center', py: 4 }}><CircularProgress aria-label="Cargando usuarios" /></Box>
      : error ? <Alert severity="error" action={<Button color="inherit" onClick={() => { setError(false); setCargando(true); setIntento(v => v + 1); }}>Reintentar</Button>}>No se pudieron cargar los usuarios.</Alert>
        : <>
          <Typography role="status" sx={{ mb: 2 }}>{visibles.length} de {usuarios.length} usuarios</Typography>
          {visibles.length === 0 ? <Alert severity="info">No se encontraron usuarios con estos filtros.</Alert> : <>
            <TableContainer component={Paper} variant="outlined" sx={{ display: { xs: 'none', md: 'block' } }}>
              <Table aria-label="Usuarios del sistema">
                <TableHead><TableRow>{['Nombre y apellido', 'Email', 'Rol', 'Estado', 'Fecha de alta', 'Acciones'].map(t => <TableCell key={t}>{t}</TableCell>)}</TableRow></TableHead>
                <TableBody>{filas.map(u => <TableRow key={u.id}>
                  <TableCell component="th" scope="row">{u.nombre} {u.apellido}</TableCell>
                  <TableCell sx={{ overflowWrap: 'anywhere' }}>{u.email}</TableCell><TableCell>{roles[u.rol] ?? u.rol}</TableCell>
                  <TableCell><Chip size="small" label={u.activo ? 'Activo' : 'Dado de baja'} color={u.activo ? 'success' : 'default'} /></TableCell>
                  <TableCell>{fecha(u.fechaAlta)}</TableCell><TableCell>{acciones(u)}</TableCell>
                </TableRow>)}</TableBody>
              </Table>
            </TableContainer>
            <Stack spacing={2} sx={{ display: { xs: 'flex', md: 'none' } }}>
              {filas.map(u => <Paper component="article" variant="outlined" key={u.id} sx={{ p: 2, overflowWrap: 'anywhere' }}>
                <Typography component="h2" variant="h6">{u.nombre} {u.apellido}</Typography>
                <Typography color="text.secondary">{u.email}</Typography>
                <Stack direction="row" spacing={1} sx={{ my: 1 }}><Chip size="small" label={roles[u.rol] ?? u.rol} /><Chip size="small" label={u.activo ? 'Activo' : 'Dado de baja'} color={u.activo ? 'success' : 'default'} /></Stack>
                <Typography variant="body2">Fecha de alta: {fecha(u.fechaAlta)}</Typography>
                <Box sx={{ mt: 2 }}>{acciones(u)}</Box>
              </Paper>)}
            </Stack>
            <TablePagination component="div" count={visibles.length} page={pagina} rowsPerPage={10} rowsPerPageOptions={[10]}
              onPageChange={(_, valor) => setPagina(valor)} labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
              getItemAriaLabel={tipo => tipo === 'next' ? 'Página siguiente' : 'Página anterior'} />
          </>}
        </>}
  </Container>;
}
