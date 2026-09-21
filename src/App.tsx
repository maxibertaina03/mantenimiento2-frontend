import { Navigate, Route, Routes } from 'react-router-dom';
import { EquiposPage } from '@/paginas/EquiposPage';
import { InicioPage } from '@/paginas/InicioPage';
import { ServiciosPage } from '@/paginas/ServiciosPage';
import { Layout } from './componentes/Layout';
import { RutaConPermiso } from './componentes/RutaConPermiso';
import { PermisosPage } from './paginas/PermisosPage';
import { P } from './lib/permisos';
import { CredencialesPage } from './paginas/CredencialesPage';
import { EquiposItPage } from './paginas/EquiposItPage';
import { MaterialesPage } from './paginas/MaterialesPage';
import { MaterialDetallePage } from './paginas/MaterialDetallePage';
import { MovimientosPage } from './paginas/MovimientosPage';
import { NuevoMovimientoPage } from './paginas/NuevoMovimientoPage';
import { OrdenesCompraPage } from './paginas/OrdenesCompraPage';
import { OrdenesTrabajoPage } from './paginas/OrdenesTrabajoPage';
import { ProveedoresPage } from './paginas/ProveedoresPage';
import { UsuariosPage } from './paginas/UsuariosPage';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* La entrada contesta "que hay que hacer hoy". Antes era el listado
            de 920 materiales, que no contesta nada: hay que saber de antemano
            que buscar. */}
        <Route index element={<InicioPage />} />
        <Route path="/inicio" element={<InicioPage />} />
        <Route
          path="/materiales"
          element={
            <RutaConPermiso permisos={[P.MATERIALES_VER]}>
              <MaterialesPage />
            </RutaConPermiso>
          }
        />
        <Route
          path="/materiales/:id"
          element={
            <RutaConPermiso permisos={[P.MATERIALES_VER]}>
              <MaterialDetallePage />
            </RutaConPermiso>
          }
        />
        <Route
          path="/movimientos"
          element={
            <RutaConPermiso permisos={[P.MOVIMIENTOS_VER]}>
              <MovimientosPage />
            </RutaConPermiso>
          }
        />
        <Route
          path="/movimientos/nuevo"
          element={
            <RutaConPermiso permisos={[P.MOVIMIENTOS_CREAR]}>
              <NuevoMovimientoPage />
            </RutaConPermiso>
          }
        />
        <Route
          path="/ordenes-trabajo"
          element={
            <RutaConPermiso permisos={[P.TRABAJOS_VER]}>
              <OrdenesTrabajoPage />
            </RutaConPermiso>
          }
        />
        <Route
          path="/ordenes-compra"
          element={
            <RutaConPermiso permisos={[P.ORDENES_VER]}>
              <OrdenesCompraPage />
            </RutaConPermiso>
          }
        />
        <Route
          path="/equipos-it"
          element={
            <RutaConPermiso permisos={[P.IT_VER]}>
              <EquiposItPage />
            </RutaConPermiso>
          }
        />
        <Route
          path="/credenciales"
          element={
            <RutaConPermiso permisos={[P.CREDENCIALES_VER]}>
              <CredencialesPage />
            </RutaConPermiso>
          }
        />
        <Route
          path="/equipos"
          element={
            <RutaConPermiso permisos={[P.EQUIPOS_VER]}>
              <EquiposPage />
            </RutaConPermiso>
          }
        />
        <Route
          path="/servicios"
          element={
            <RutaConPermiso permisos={[P.SERVICIOS_VER]}>
              <ServiciosPage />
            </RutaConPermiso>
          }
        />
        <Route
          path="/proveedores"
          element={
            <RutaConPermiso permisos={[P.PROVEEDORES_VER]}>
              <ProveedoresPage />
            </RutaConPermiso>
          }
        />
        <Route
          path="/usuarios"
          element={
            <RutaConPermiso permisos={[P.USUARIOS_ADMINISTRAR]}>
              <UsuariosPage />
            </RutaConPermiso>
          }
        />
        <Route
          path="/permisos"
          element={
            <RutaConPermiso permisos={[P.PERMISOS_ADMINISTRAR]}>
              <PermisosPage />
            </RutaConPermiso>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
