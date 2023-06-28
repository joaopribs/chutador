class HomeController < ApplicationController
  before_action :set_locale

  def set_locale
    I18n.locale = extract_locale_from_headers
  end

  def index
  end

  private

  def extract_locale_from_headers
    http_accept_language = request.env['HTTP_ACCEPT_LANGUAGE']
    if http_accept_language.present?
      return http_accept_language.scan(/^[a-z]{2}/).first.presence
    end
    
    'en'
  end
end