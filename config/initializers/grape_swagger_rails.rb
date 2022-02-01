# frozen_string_literal: true

unless Rails.env.production?
  GrapeSwaggerRails.options.url      = '/api/v1/swagger_doc'
  GrapeSwaggerRails.options.app_name = 'Chutador'
  GrapeSwaggerRails.options.before_action do
    GrapeSwaggerRails.options.app_url = request.protocol + request.host_with_port
    #   GrapeSwaggerRails.options.headers['Swagger_Authorization'] = current_user.try(:auth_token)
    #   GrapeSwaggerRails.options.headers['Swagger_User-Code'] = current_user.try(:code)
  end
end
