import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'
import { readInitialResolvedTheme } from '@/lib/themePreference'

const header = '#023047'
const onHeader = '#FFFFFF'

export default createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: readInitialResolvedTheme(),
    themes: {
      light: {
        dark: false,
        colors: {
          background: '#f4f7fb',
          surface: '#FFFFFF',
          primary: '#023047',
          'primary-darken-1': '#011f2e',
          'on-primary': '#FFFFFF',
          'on-surface': '#0f172a',
          'on-background': '#0f172a',
          header,
          'on-header': onHeader,
        },
      },
      dark: {
        dark: true,
        colors: {
          background: '#07161d',
          surface: '#102833',
          primary: '#8ecae6',
          'primary-darken-1': '#5aa8c9',
          'on-primary': '#023047',
          'on-surface': '#e7eef2',
          'on-background': '#e7eef2',
          header,
          'on-header': onHeader,
        },
      },
    },
  },
})
