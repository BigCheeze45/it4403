FROM jekyll/jekyll:pages

RUN apt update -y

COPY ./docs/Gemfile* .
RUN bundle install
