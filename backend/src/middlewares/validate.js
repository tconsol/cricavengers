const Joi = require('joi');
const { AppError } = require('./errorHandler');

const validate = (schema, source = 'body') => (req, res, next) => {
  const data = source === 'body' ? req.body
    : source === 'query' ? req.query
    : req.params;

  const { error, value } = schema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const message = error.details.map((d) => d.message.replace(/"/g, '')).join('; ');
    return next(new AppError(message, 400, 'VALIDATION_ERROR'));
  }

  if (source === 'body') req.body = value;
  else if (source === 'query') req.query = value;
  else req.params = value;

  next();
};

module.exports = validate;
