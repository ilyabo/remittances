use Rack::Static,
  :urls => ["/data", "/js", "/lib", "/css", "/images"],
  :root => "site"

run lambda { |env|
  [
    200,
    {
      'Content-Type'  => 'text/html',
      'Cache-Control' => 'public, max-age=86400'
    },
    File.open('site/index.html', File::RDONLY)
    
  ]
}
