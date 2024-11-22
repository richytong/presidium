#!/bin/bash
FQDN=$1

# make directories to work from
mkdir -p server/ client/ all/

# Create your very own Root Certificate Authority
openssl genrsa \
  -out all/my-private-root-ca.privkey.pem \
  2048

# Self-sign your Root Certificate Authority
# Since this is private, the details can be as bogus as you like
openssl req \
  -x509 \
  -new \
  -nodes \
  -key all/my-private-root-ca.privkey.pem \
  -days 1024 \
  -out all/my-private-root-ca.cert.pem \
  -subj "/C=US/ST=Utah/L=Provo/O=ACME Signing Authority Inc/CN=example.com"

# Create a Device Certificate for each domain,
# such as example.com, *.example.com, awesome.example.com
# NOTE: You MUST match CN to the domain name or ip address you want to use
openssl genrsa \
  -out all/privkey.pem \
  2048

# Create a request from your Device, which your Root CA will sign
openssl req -new \
  -key all/privkey.pem \
  -out all/csr.pem \
  -subj "/C=US/ST=Utah/L=Provo/O=ACME Tech Inc/CN=${FQDN}"
