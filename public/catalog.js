window.APP_CATALOG = {
  manufacturers: [
    {
      name: 'Fortinet',
      description: 'Seguridad de red, SASE, ZTNA, SOC y protección de infraestructura.',
      solutions: [
        {
          name: 'NGFW',
          products: ['FortiGate', 'FortiManager', 'FortiAnalyzer'],
          value: ['Segmentación', 'Inspección avanzada', 'Visibilidad centralizada']
        },
        {
          name: 'SASE',
          products: ['FortiSASE', 'FortiClient', 'FortiAuthenticator'],
          value: ['Acceso seguro', 'Políticas unificadas', 'Experiencia remota']
        },
        {
          name: 'SOC / SIEM',
          products: ['FortiSIEM', 'FortiSOAR', 'FortiAnalyzer'],
          value: ['Correlación', 'Automatización', 'Respuesta']
        }
      ]
    },
    {
      name: 'F5',
      description: 'ADC, WAAP, API Security y protección de aplicaciones críticas.',
      solutions: [
        {
          name: 'WAAP',
          products: ['BIG-IP Advanced WAF', 'Distributed Cloud WAAP', 'Bot Defense'],
          value: ['Protección web', 'Mitigación de bots', 'Seguridad de APIs']
        },
        {
          name: 'ADC',
          products: ['BIG-IP LTM', 'NGINX Plus'],
          value: ['Disponibilidad', 'Balanceo', 'Optimización']
        },
        {
          name: 'API Security',
          products: ['Distributed Cloud API Security', 'NGINX App Protect'],
          value: ['Descubrimiento', 'Postura', 'Protección']
        }
      ]
    },
    {
      name: 'Palo Alto Networks',
      description: 'Plataformas de red, cloud y operaciones de seguridad.',
      solutions: [
        {
          name: 'SASE',
          products: ['Prisma Access', 'Cortex XDR'],
          value: ['Acceso seguro', 'Inspección cloud', 'Experiencia global']
        },
        {
          name: 'Cloud Security',
          products: ['Prisma Cloud'],
          value: ['CNAPP', 'Postura', 'Protección runtime']
        },
        {
          name: 'SOC / XDR',
          products: ['Cortex XDR', 'Cortex XSOAR'],
          value: ['Detección', 'Orquestación', 'Respuesta']
        }
      ]
    },
    {
      name: 'Imperva',
      description: 'Seguridad de aplicaciones, APIs, DDoS y datos.',
      solutions: [
        {
          name: 'WAAP',
          products: ['Imperva WAF', 'API Security', 'Bot Protection'],
          value: ['WAF', 'Protección API', 'Defensa de bots']
        },
        {
          name: 'DDoS Protection',
          products: ['Imperva DDoS Protection'],
          value: ['Mitigación', 'Continuidad', 'Protección perimetral']
        },
        {
          name: 'Data Security',
          products: ['Data Risk Analytics', 'Database Security'],
          value: ['Visibilidad', 'Cumplimiento', 'Protección de datos']
        }
      ]
    }
  ]
};
