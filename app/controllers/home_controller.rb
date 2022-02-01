class HomeController < ApplicationController
  before_action :set_locale

  def set_locale
    I18n.locale = extract_locale_from_headers
  end

  def index
  end

  private

  def extract_locale_from_headers
    request.env['HTTP_ACCEPT_LANGUAGE'].scan(/^[a-z]{2}/).first.presence || 'en'
  end
end