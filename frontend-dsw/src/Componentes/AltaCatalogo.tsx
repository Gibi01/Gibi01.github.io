import IconoEspecialidad from './IconoEspecialidad';
import { useEffect, useState, type FormEvent } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, List, ListItem, ListItemText, Paper, Stack, TablePagination, TextField, Typography } from '@mui/material';
import SelectorIconoEspecialidad from './SelectorIconoEspecialidad';
import { crearEspecialidad, getEspecialidades } from '../Servicios/especialidadesService';
import { crearObraSocial, getObrasSociales } from '../Servicios/obraSocialService';
import { crearMotivoCancelacion, getMotivosCancelacion } from '../Servicios/motivoCancelacionService';
import { claveNombreCatalogo, nombreCatalogo, primeraMayuscula } from '../Servicios/nombreCatalogo';

type Tipo = 'especialidad' | 'obraSocial' | 'motivo';
type Registro = { id: number; nombre: string; icono?: string };
const textos = {
  especialidad: { titulo: 'Nueva especialidad', lista: 'Especialidades existentes', campo: 'Descripción', crear: 'Crear especialidad' },
  obraSocial: { titulo: 'Nueva obra social', lista: 'Obras sociales existentes', campo: 'Nombre', crear: 'Crear obra social' },
  motivo: { titulo: 'Nuevo motivo de cancelación', lista: 'Motivos existentes', campo: 'Descripción', crear: 'Crear motivo' },
};
async function listar(tipo: Tipo): Promise<Registro[]> {
  if (tipo === 'especialidad') return (await getEspecialidades()).map(e => ({ id: e.idEspecialidad, nombre: e.descripcionEsp, icono: e.icono }));
  if (tipo === 'obraSocial') return (await getObrasSociales()).map(e => ({ id: e.id, nombre: e.nombre }));
  return (await getMotivosCancelacion()).map(e => ({ id: e.id, nombre: e.descripcion }));
}

export default function AltaCatalogo({ tipo, onCreado }: { tipo: Tipo; onCreado: () => void }) {
  const texto = textos[tipo];
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorLista, setErrorLista] = useState('');
  const [revision, setRevision] = useState(0);
  const [nombre, setNombre] = useState('');
  const [icono, setIcono] = useState('medicina');
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  useEffect(() => {
    let vigente = true;
    listar(tipo).then(datos => { if (vigente) setRegistros(datos); })
      .catch(() => { if (vigente) setErrorLista('No se pudo cargar el listado. Reintentá antes de crear un registro.'); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [tipo, revision]);
  const recargar = () => { setCargando(true); setErrorLista(''); setRevision(r => r + 1); };
  const clave = claveNombreCatalogo(nombre);
  const duplicado = registros.find(r => claveNombreCatalogo(r.nombre) === clave);
  const similares = clave.length >= 3 ? registros.filter(r => claveNombreCatalogo(r.nombre).includes(clave) || clave.includes(claveNombreCatalogo(r.nombre))) : [];
  const filtrados = registros.filter(r => claveNombreCatalogo(r.nombre).includes(claveNombreCatalogo(busqueda)))
    .sort((a, b) => Number(b.id === duplicado?.id) - Number(a.id === duplicado?.id) || a.nombre.localeCompare(b.nombre, 'es'));

  const paginaActual = Math.min(pagina, Math.max(0, Math.ceil(filtrados.length / 5) - 1));

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (!clave || duplicado || cargando || errorLista || guardando) return;
    const valor = nombreCatalogo(nombre);
    setGuardando(true); setError(''); setOk('');
    try {
      if (tipo === 'especialidad') await crearEspecialidad({ descripcionEsp: valor, icono });
      else if (tipo === 'obraSocial') await crearObraSocial({ nombre: valor });
      else await crearMotivoCancelacion({ descripcion: valor });
      setNombre(''); setIcono('medicina'); setBusqueda(''); setPagina(0);
      setOk(`Se creó «${valor}».`); recargar(); onCreado();
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar.'); recargar(); }
    finally { setGuardando(false); }
  };

  return <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) minmax(0, 1.2fr)' }, gap: 3 }}>
    <Paper component="form" onSubmit={guardar} variant="outlined" sx={{ p: { xs: 2, sm: 3 }, minWidth: 0 }}>
      <Typography component="h2" variant="h6" sx={{ mb: 2 }}>{texto.titulo}</Typography>
      {ok && <Alert severity="success" sx={{ mb: 2 }}>{ok}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <TextField fullWidth label={texto.campo} value={nombre} disabled={guardando} error={!!duplicado}
        helperText={duplicado ? `Ya existe «${duplicado.nombre}».` : 'La primera letra se guarda en mayúscula.'}
        slotProps={{ htmlInput: { maxLength: 150 } }}
        onChange={e => { setNombre(primeraMayuscula(e.target.value)); setPagina(0); setError(''); setOk(''); }}
        onBlur={() => setNombre(nombreCatalogo(nombre))} />
      {!duplicado && similares.length > 0 && <Alert severity="info" sx={{ mt: 2 }}>Hay nombres parecidos: {similares.slice(0, 3).map(r => r.nombre).join(', ')}. Revisalos antes de crear.</Alert>}
      {tipo === 'especialidad' && <SelectorIconoEspecialidad valor={icono} onChange={setIcono} nombre={nombre} disabled={guardando} />}
      <Button type="submit" variant="contained" fullWidth sx={{ mt: 3 }} disabled={!clave || !!duplicado || cargando || !!errorLista || guardando}>
        {guardando ? 'Guardando…' : texto.crear}
      </Button>
    </Paper>
    <Paper component="section" aria-label={texto.lista} variant="outlined" sx={{ p: { xs: 2, sm: 3 }, minWidth: 0 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
        <Typography component="h2" variant="h6">{texto.lista}</Typography><Chip label={registros.length} size="small" />
      </Stack>
      <TextField fullWidth label="Buscar en el listado" value={busqueda} onChange={e => { setBusqueda(e.target.value); setPagina(0); }} />
      {duplicado && <Alert severity="warning" sx={{ mt: 2 }}>Ya registrado: {duplicado.nombre}</Alert>}
      {cargando ? <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress aria-label="Cargando registros" /></Box>
        : errorLista ? <Alert severity="error" sx={{ mt: 2 }} action={<Button onClick={recargar}>Reintentar</Button>}>{errorLista}</Alert>
        : <>
          <List>{filtrados.slice(paginaActual * 5, paginaActual * 5 + 5).map(r => <ListItem key={r.id} divider sx={{ bgcolor: r.id === duplicado?.id ? 'action.selected' : undefined, gap: 1 }}>
            {tipo === 'especialidad' && <IconoEspecialidad icono={r.icono} />}
            <ListItemText primary={r.nombre} slotProps={{ primary: { sx: { overflowWrap: 'anywhere' } } }} />
            {r.id === duplicado?.id && <Chip label="Ya registrado" size="small" color="warning" />}
          </ListItem>)}</List>
          {!filtrados.length && <Typography color="text.secondary" sx={{ py: 2 }}>{registros.length ? 'No hay coincidencias con tu búsqueda.' : 'Todavía no hay registros.'}</Typography>}
          <TablePagination component="div" count={filtrados.length} page={paginaActual} onPageChange={(_, p) => setPagina(p)} rowsPerPage={5} rowsPerPageOptions={[]}
            labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`} getItemAriaLabel={tipo => tipo === 'next' ? 'Página siguiente' : 'Página anterior'}
            sx={{ '& .MuiTablePagination-toolbar': { px: 0 }, '& .MuiTablePagination-spacer': { flex: '1 1 0' } }} />
        </>}
    </Paper>
  </Box>;
}
