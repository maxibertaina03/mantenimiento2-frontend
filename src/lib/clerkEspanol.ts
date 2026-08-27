import { esES } from '@clerk/localizations';

type Localizacion = typeof esES;

/**
 * Traducción al español de la UI de Clerk (login y registro).
 *
 * Parte del paquete oficial `esES` y le ajusta los textos que queremos en
 * español rioplatense (voseo: "iniciá", "creá", "ingresá") y los que mencionan
 * al sistema por su nombre.
 */
export const clerkEspanol: Localizacion = {
  ...esES,

  socialButtonsBlockButton: 'Continuar con {{provider|titleize}}',
  dividerText: 'o',
  formFieldLabel__emailAddress: 'Correo electrónico',
  formFieldLabel__password: 'Contraseña',
  formFieldLabel__username: 'Usuario',
  formFieldLabel__firstName: 'Nombre',
  formFieldLabel__lastName: 'Apellido',
  formFieldLabel__emailAddress_username: 'Correo electrónico o usuario',
  formFieldInputPlaceholder__emailAddress: 'tunombre@empresa.com',
  formFieldInputPlaceholder__username: 'Tu usuario',
  formButtonPrimary: 'Continuar',
  backButton: 'Volver',

  signIn: {
    ...esES.signIn,
    start: {
      ...esES.signIn?.start,
      title: 'Iniciá sesión',
      subtitle: 'Ingresá para gestionar el stock y el mantenimiento.',
      actionText: '¿No tenés cuenta?',
      actionLink: 'Registrate',
    },
    password: {
      ...esES.signIn?.password,
      title: 'Ingresá tu contraseña',
      subtitle: 'Escribí la contraseña de tu cuenta.',
    },
  },

  signUp: {
    ...esES.signUp,
    start: {
      ...esES.signUp?.start,
      title: 'Creá tu cuenta',
      subtitle: 'Registrate para acceder al sistema de mantenimiento.',
      actionText: '¿Ya tenés cuenta?',
      actionLink: 'Iniciá sesión',
    },
  },

  userButton: {
    ...esES.userButton,
    action__signOut: 'Cerrar sesión',
    action__manageAccount: 'Administrar cuenta',
  },
};
