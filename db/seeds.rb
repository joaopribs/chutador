# This file should contain all the record creation needed to seed the database with its default values.
# The data can then be loaded with the bin/rails db:seed command (or created alongside the database with db:setup).
#
# Examples:
#
#   movies = Movie.create([{ name: "Star Wars" }, { name: "Lord of the Rings" }])
#   Character.create(name: "Luke", movie: movies.first)

if ActiveRecord::Base.connection.execute("SELECT * FROM words WHERE language = 'PT' LIMIT 1").count == 0
  puts "Seeding portuguese words"

  sql = File.open('resources/portuguese.sql').read
  ActiveRecord::Base.connection.execute(sql)
else
  puts "Portuguese words are already added"
end

if ActiveRecord::Base.connection.execute("SELECT * FROM words WHERE language = 'EN' LIMIT 1").count == 0
  puts "Seeding english words"

  sql = File.open('resources/english.sql').read
  ActiveRecord::Base.connection.execute(sql)
else
  puts "English words are already added"
end