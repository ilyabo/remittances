(ns remittance-data.core
  (:use [remittance-data.utils])
  (:use [incanter.core])
  (:use [incanter.io])
  (:use [incanter.stats])
  (:use [incanter.excel])
  (:require [clojure.data.json :as json])
  (:require [clj-diff.core :as diff])
  )






; what we need
;
; 1. remittances unilateral with country codes, german names (and optionally english),
;    coordinates + 2012?
; 2. migration bilateral (top 75% flows) 1970-2000 + 2010
; 3. migration unilateral outgoing totals (but 100% of the flows!) for each country in each decade
; 4. OECD development aid unilateral incoming totals for each recipient country




(def remittances (read-xls "data-original/RemittancesData_Inflows_Nov12.xlsx"))


(def un-country-codes (read-dataset
   "data-original/un-country-codes.csv"
   :header true))

(def aid (read-dataset
   "data-original/oecd/REF_TOTAL_ODF_Data_a83fb694-6ff5-4883-91cf-f79a5e557c69.csv"
   :header true))

; to get the rows use   (:rows aid)


(defn find-country [country lang]
    (filter #(in? (get % "types") "country")
    (get (json/read-str (fetch-url
      (str
        "http://maps.googleapis.com/maps/api/geocode/json?"
        "sensor=false"
        "&language=" lang
        "&components=types"
        "&address="
        country
        ))) "results")))

(def find-country-memo (memoize find-country))




;(defn my-distance [name name-official]
;  (let [
;     d        (diff/diff name name-official)
;     len      (count name)
;     common   (- len (count (:- d)))
;    ]
;
;    (*
;      (+ 0.1 (- 1 (/ common len)))
;      (count (:+ d)))
;      (* 0.1 (reduce + 0  (map count (:+ d))))
;    ))


(defn my-distance [name1 name2]
  (let [
     common      (common-word-prefixes (.toLowerCase name1) (.toLowerCase name2) 2)
     common-len  (map count common)
    ]

    (reduce - 0 (map #(pow 2 %) common-len))
 ))






(defn find-closest-country-code [name]
  (let [
     closest (apply min-key
;                 #(levenshtein-distance (:name %) name)
;                 #(- (count (lcs (:name %) name)))

                #(my-distance name (:name %))

                (:rows un-country-codes)
               )

    ]
    (do
      (println (str "Using the closest country code: " closest))
      (newline)
      (:code closest))))




(let [un-contry-codes-by-name (group-by :name (:rows un-country-codes))]

(defn find-country-code [name]
  (let [
    code (:code (first (get un-contry-codes-by-name name)))
   ]
    (if code code
      (do
        (newline) (newline)
        (println (str "WARNING! No code found for '" name "'"))

        (find-closest-country-code name)
      ))

  )))


(let [country-key "Migrant remittance Inflows (US$ million)"]

(defn prepare-remittances [rows]
    (for [row (filter #(get % "2012e") rows)]
       (let [
          name (get row country-key)
        ]
       {
        :name name
        :code (find-country-code name)
       })
     )
  ))








(comment

  (prepare-remittances (take 30 (:rows remittances)))
  (prepare-remittances (:rows remittances))


  (find-country-memo "Congo" "de")

  (levenshtein-distance "a" "b")
)






