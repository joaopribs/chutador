# frozen_string_literal: true

class CustomError < StandardError
  attr_accessor :code, :http_status

  def initialize(message, code, http_status)
    @code = code
    @http_status = http_status
    super(message)
  end
end
