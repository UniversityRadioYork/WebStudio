package config

import (
	"fmt"
	"github.com/spf13/pflag"
	"github.com/spf13/viper"
	"go.uber.org/zap/zapcore"
)

type TurnProvider string

const (
	TurnProviderTwilio TurnProvider = "twilio"
)

type PythonBool bool

func (p *PythonBool) UnmarshalText(text []byte) error {
	*p = string(text) == "True"
	return nil
}

type Sentry struct {
	Enable PythonBool
	DSN    string
}

type Twilio struct {
	AccountSID string `mapstructure:"account_sid"`
	AuthToken  string `mapstructure:"auth_token"`
}

type Server struct {
	NotifyURL       string        `mapstructure:"notify_url"`
	WebsocketPort   int           `mapstructure:"websocket_port"`
	TelnetPort      int           `mapstructure:"telnet_port"`
	TurnProvider    TurnProvider  `mapstructure:"turn_provider"`
	LogLevel        zapcore.Level `mapstructure:"log_level"`
	DevelopmentMode bool          `mapstructure:"development_mode"`
}

type Config struct {
	Sentry Sentry `mapstructure:"sentry"`
	Twilio Twilio `mapstructure:"twilio"`
	Server Server `mapstructure:"neoserver"`
}

func LoadConfig(overridePath string) (*Config, error) {
	cfg := viper.New()
	cfg.SetConfigName("serverconfig")
	cfg.SetConfigType("ini")
	if overridePath != "" {
		cfg.AddConfigPath(overridePath)
	} else {
		cfg.AddConfigPath(".")
	}
	err := viper.BindPFlags(pflag.CommandLine)
	if err != nil {
		return nil, fmt.Errorf("could not bind PFlags: %w", err)
	}
	err = cfg.ReadInConfig()
	if err != nil {
		return nil, err
	}
	var result Config
	err = cfg.Unmarshal(&result)
	if err != nil {
		return nil, fmt.Errorf("could not unmarshal config: %w", err)
	}
	cfg.SafeWriteConfig()
	return &result, nil
}
