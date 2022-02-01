class CreateWords < ActiveRecord::Migration[6.1]
  def change
    create_table :words, id: false do |t|
      t.string :word
      t.string :language
    end
  end
end
