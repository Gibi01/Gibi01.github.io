import AdminUsuarioDetalle from './Paginas/AdminUsuarioDetalle';
import AdminAgendas from './Paginas/AdminAgendas';
import { Routes, Route } from "react-router-dom";

import Inicio from "./Paginas/Inicio";
import Doctores from "./Paginas/doctores";
import DoctorDetalle from "./Paginas/DoctorDetalle";
import Especialidades from "./Paginas/Especialidades";
import EspecialidadTurnos from "./Paginas/EspecialidadTurnos";
import Registro from "./Paginas/Registro";
import Login from "./Paginas/Login";
import RecuperarPassword from "./Paginas/RecuperarPassword";
import MisTurnos from "./Paginas/MisTurnos";
import TurnosPacientes from "./Paginas/TurnosPacientes";
import MiAgenda from "./Paginas/MiAgenda";
import Perfil from "./Paginas/Perfil";
import AdminCargaDatos from "./Paginas/AdminCargaDatos";
import AdminModificarDatos from "./Paginas/AdminModificarDatos";
import AdminUsuarios from './Paginas/AdminUsuarios';
import RutaPrivada from "./Componentes/RutaPrivada";
import RutaAdmin from "./Componentes/RutaAdmin";
import RutaDoctor from "./Componentes/RutaDoctor";

function App() {
  return (
    <Routes>
      <Route path="/admin/agendas" element={<RutaAdmin><AdminAgendas /></RutaAdmin>} />
      <Route path="/admin/usuarios/:id" element={<RutaAdmin><AdminUsuarioDetalle /></RutaAdmin>} />
      <Route path="/admin/usuarios" element={<RutaAdmin><AdminUsuarios /></RutaAdmin>} />
      <Route path="/" element={<Inicio />} />
      <Route path="/reserva" element={<Especialidades />} />
      <Route path="/doctores" element={<Doctores />} />
      <Route path="/doctores/:matricula" element={<DoctorDetalle />} />
      <Route path="/especialidades" element={<Especialidades />} />
      <Route path="/especialidades/:id/turnos" element={<EspecialidadTurnos />} />
      <Route path="/registro" element={<Registro />} />
      <Route path="/login" element={<Login />} />
      <Route path="/recuperar-password" element={<RecuperarPassword />} />
      <Route
        path="/mis-turnos"
        element={
          <RutaPrivada>
            <MisTurnos />
          </RutaPrivada>
        }
      />
      <Route
        path="/mis-turnos/atender"
        element={
          <RutaDoctor>
            <TurnosPacientes />
          </RutaDoctor>
        }
      />
      <Route
        path="/mi-agenda"
        element={
          <RutaDoctor>
            <MiAgenda />
          </RutaDoctor>
        }
      />
      <Route
        path="/perfil"
        element={
          <RutaPrivada>
            <Perfil />
          </RutaPrivada>
        }
      />
      <Route
        path="/admin/carga"
        element={
          <RutaAdmin>
            <AdminCargaDatos />
          </RutaAdmin>
        }
      />
      <Route
        path="/admin/modificar"
        element={
          <RutaAdmin>
            <AdminModificarDatos />
          </RutaAdmin>
        }
      />
    </Routes>
  );
}

export default App;
