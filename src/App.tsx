import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Cargando } from './componentes/Estados';
import { EquiposPage } from '@/paginas/EquiposPage';
import { EquipoPage } from '@/paginas/EquipoPage';
import { InicioPage } from '@/paginas/InicioPage';
import { InventarioPage } from '@/paginas/InventarioPage';
import { TomaInventarioPage } from '@/paginas/TomaInventarioPage';
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
import { PreciosFacturaPage } from './paginas/PreciosFacturaPage';
import { CalendarioPage } from './paginas/CalendarioPage';
import { PendientesPage } from './paginas/PendientesPage';
import { SolicitudesPage } from './paginas/SolicitudesPage';
import { SectorPage } from './paginas/SectorPage';
import { SectoresPage } from './paginas/SectoresPage';
import { OrdenesTrabajoPage } from './paginas/OrdenesTrabajoPage';
import { ProveedoresPage } from './paginas/ProveedoresPage';
import { UsuariosPage } from './paginas/UsuariosPage';

// Los informes se bajan recién al entrar: traen la librería de gráficos, que
// pesa, y el que entra a cargar un movimiento no tiene por qué esperarla.
const InformesPage = lazy(() =>
  import('./paginas/InformesPage').then((m) => ({ default: m.InformesPage })),
);
const MisResultadosPage = lazy(() =>
  import('./paginas/MisResultadosPage').then((m) => ({ default: m.MisResultadosPage })),
);
const aPedido = (pagina: ReactNode) => <Suspense fallback={<Cargando />}>{pagina}</Suspense>;

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
          path="/pendientes"
          element={
            <RutaConPermiso permisos={[P.PENDIENTES_VER]}>
              <PendientesPage />
            </RutaConPermiso>
          }
        />
        <Route
          path="/sectores"
          element={
            <RutaConPermiso permisos={[P.TRABAJOS_VER]}>
              <SectoresPage />
            </RutaConPermiso>
          }
        />
        <Route
          path="/sectores/:id"
          element={
            <RutaConPermiso permisos={[P.TRABAJOS_VER]}>
              <SectorPage />
            </RutaConPermiso>
          }
        />
        <Route
          path="/inventario"
          element={
            <RutaConPermiso permisos={[P.INVENTARIO_VER]}>
              <InventarioPage />
            </RutaConPermiso>
          }
        />
        <Route
          path="/inventario/:id"
          element={
            <RutaConPermiso permisos={[P.INVENTARIO_VER]}>
              <TomaInventarioPage />
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
          path="/informes"
          element={
            <RutaConPermiso permisos={[P.INFORMES_VER]}>{aPedido(<InformesPage />)}</RutaConPermiso>
          }
        />
        {/* Sin permiso: cada uno ve lo suyo. */}
        <Route path="/mis-resultados" element={aPedido(<MisResultadosPage />)} />
        <Route
          path="/calendario"
          element={
            <RutaConPermiso permisos={[P.TAREAS_VER]}>
              <CalendarioPage />
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
        {/* Sin RutaConPermiso: entra quien carga (ve las suyas) o quien ve todas.
            La página decide cuál; el servidor igual lo controla. */}
        <Route path="/solicitudes" element={<SolicitudesPage />} />
        <Route
          path="/ordenes-compra"
          element={
            <RutaConPermiso permisos={[P.ORDENES_VER]}>
              <OrdenesCompraPage />
            </RutaConPermiso>
          }
        />
        <Route
          path="/ordenes-compra/:id/factura"
          element={
            <RutaConPermiso permisos={[P.ORDENES_EDITAR]}>
              <PreciosFacturaPage />
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
          path="/equipos/:id"
          element={
            <RutaConPermiso permisos={[P.EQUIPOS_VER]}>
              <EquipoPage />
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
