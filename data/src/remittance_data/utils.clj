(ns remittance-data.utils
  (:import [java.net URLEncoder])
  ;(:import clj_diff.FastStringOps)
  )



(defn fetch-url [address]
  "
    This will work on text files but corrupt binary files because BufferedReader
    assumes it is dealing with textual data.
   "
  (with-open [stream (.openStream (java.net.URL. address))]
    (let  [buf (java.io.BufferedReader.
                (java.io.InputStreamReader. stream))]
      (apply str (line-seq buf)))))


(defn in?
  "true if seq contains elm"
  [seq elm]
  (some #(= elm %) seq))




(defn words [text]
  (re-seq #"\p{Alpha}+" text))


; https://github.com/technomancy/swank-clojure/blob/master/src/swank/util/string.clj
(defn largest-common-prefix
  "Returns the largest common prefix of two strings."
  ([#^String a, #^String b]
     (apply str (take-while (comp not nil?) (map #(when (= %1 %2) %1) a b))))
  {:tag String})


;(FastStringOps/commonPrefix "abc" "abd")


(defn common-word-prefixes [text1 text2 min-length]
  (let [
     words1  (words text1)
     words2  (words text2)]

    (filter #(>= (count %) min-length)
      (for [w1 words1  w2 words2]
        (largest-common-prefix w1 w2)
      )))
  )


(defn encode-url-params [request-params]
  (let [encode #(URLEncoder/encode (str %) "UTF-8")
        coded (for [[n v] request-params] (str (encode n) "=" (encode v)))]
    (apply str (interpose "&" coded))))


(defn round
   [x & {p :precision}]
   (if p
     (let [scale (Math/pow 10 p)]
       (-> x (* scale) Math/round (/ scale)))
     (Math/round x)))
