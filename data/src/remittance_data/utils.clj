(ns remittance-data.utils)



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







