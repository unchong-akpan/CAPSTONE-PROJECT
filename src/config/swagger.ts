import swaggerJsdoc from 'swagger-jsdoc';

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Eventful API',
    version: '1.0.0',
    description: 'API documentation for the Eventful capstone project',
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  servers: [
    {
      url: 'http://localhost:5000',
      description: 'Local development server',
    },
  ],
};

const options = {
  swaggerDefinition,
  apis: ['./src/routes/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
