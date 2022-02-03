# frozen_string_literal: true

module Chutador
  module V1
    class Base < Grape::API
      format :json
      version 'v1'
      prefix :api

      desc 'Finds words with specified params'
      params do
        requires :language, desc: 'Language', values: %w[PT EN]
        optional :letters_in_positions, type: Array[String], desc: 'Letters in positions'
        optional :letters_not_in_positions, type: Array[String], desc: 'Letters not in positions'
        optional :letters_to_exclude, desc: 'Letters to exclude'
        requires :length, type: Integer, desc: 'Word length'
      end
      post 'find', http_codes: [
        [201, 'Ok'],
        [500, 'Service Error']
      ] do
        where_conditions = ["language = ?", "LENGTH(word) = ?"]
        query_params = [params[:language], params[:length]]

        letters = ('a'..'z').to_a + ('A'..'Z').to_a

        if params[:letters_in_positions].present?
          params[:letters_in_positions].each do |letters_in_position|
            if letters_in_position.size > params[:length].to_i
              raise CustomError.new("Letters in position must be at most #{params[:length]} characters long", 'LettersInPositions', 400)
            end

            letters_in_position.split('').each_with_index do |letter, index|
              if letters.include?(letter)
                where_conditions << "SUBSTR(word, ?, 1) = ?"
                query_params << (index + 1)
                query_params << letter
              end
            end
          end
        end

        if params[:letters_not_in_positions].present?
          params[:letters_not_in_positions].each do |letters_not_in_position|
            if letters_not_in_position.size > params[:length].to_i
              raise CustomError.new("Letters not in position must be at most #{params[:length]} characters long", 'LettersNotInPosition', 400)
            end

            letters_not_in_position.split('').each_with_index do |letter, index|
              if letters.include?(letter)
                where_conditions << "POSITION(? IN word) != ?"
                query_params << letter
                query_params << (index + 1)
                where_conditions << "word LIKE ?"
                query_params << "%#{letter}%"
              end
            end
          end
        end

        if params[:letters_to_exclude].present?
          params[:letters_to_exclude].each_char do |letter|
            if letters.include?(letter)
              where_conditions << "word NOT LIKE ?"
              query_params << "%#{letter}%"
            end
          end
        end

        query = "SELECT word
               FROM words
               WHERE #{where_conditions.join(' AND ')}
               ORDER BY word ASC"

        sanitize_params = [query, *query_params]

        sql = ActiveRecord::Base.send(:sanitize_sql_array, sanitize_params)

        words_array = ActiveRecord::Base.connection.execute(sql)

        {
          count: words_array.count,
          words: words_array.map { |w| w[0] }
        }
      end

      add_swagger_documentation \
        array_use_braces: true
    end
  end
end
