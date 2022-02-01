# frozen_string_literal: true

require 'grape-swagger'

module Chutador
  class Root < Grape::API
    format :json
    prefix :api

    rescue_from CustomError do |e|
      exception = {
        error_code: e.code,
        error_desc: e.message
      }
      Root.log_error(e) if e.http_status == 500
      error!(exception, e.http_status)
    end

    mount Chutador::V1::Base
  end
end
