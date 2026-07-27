--
-- PostgreSQL database dump
--

\restrict Wgo3aPSqZKY3G3kfxpWfzKY52JWzgMvlSHR4hStRxUxD3ieKkBNV5TLEkbsqtzJ

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: card_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.card_status AS ENUM (
    'pending',
    'active',
    'frozen',
    'terminated',
    'cancelled'
);


ALTER TYPE public.card_status OWNER TO postgres;

--
-- Name: chat_sender; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.chat_sender AS ENUM (
    'user',
    'bot',
    'admin'
);


ALTER TYPE public.chat_sender OWNER TO postgres;

--
-- Name: chat_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.chat_status AS ENUM (
    'active',
    'waiting_agent',
    'closed'
);


ALTER TYPE public.chat_status OWNER TO postgres;

--
-- Name: currency; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.currency AS ENUM (
    'MonCash',
    'NatCash',
    'USDT_TRC20'
);


ALTER TYPE public.currency OWNER TO postgres;

--
-- Name: deposit_method; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.deposit_method AS ENUM (
    'usdt',
    'moncash',
    'nowpayments',
    'paypal'
);


ALTER TYPE public.deposit_method OWNER TO postgres;

--
-- Name: kyc_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.kyc_status AS ENUM (
    'not_submitted',
    'pending',
    'verified',
    'rejected'
);


ALTER TYPE public.kyc_status OWNER TO postgres;

--
-- Name: merchant_txn_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.merchant_txn_status AS ENUM (
    'pending',
    'completed',
    'expired',
    'failed'
);


ALTER TYPE public.merchant_txn_status OWNER TO postgres;

--
-- Name: notification_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.notification_type AS ENUM (
    'deposit_approved',
    'deposit_rejected',
    'withdrawal_approved',
    'withdrawal_rejected',
    'kyc_verified',
    'kyc_rejected',
    'custom_message',
    'transfer_received',
    'transfer_sent'
);


ALTER TYPE public.notification_type OWNER TO postgres;

--
-- Name: payout_method; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.payout_method AS ENUM (
    'moncash',
    'natcash',
    'zelle',
    'cashapp'
);


ALTER TYPE public.payout_method OWNER TO postgres;

--
-- Name: payout_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.payout_status AS ENUM (
    'pending',
    'approved',
    'rejected'
);


ALTER TYPE public.payout_status OWNER TO postgres;

--
-- Name: referral_earning_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.referral_earning_type AS ENUM (
    'registration',
    'kyc',
    'deposit'
);


ALTER TYPE public.referral_earning_type OWNER TO postgres;

--
-- Name: referral_payout_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.referral_payout_status AS ENUM (
    'pending',
    'approved',
    'rejected'
);


ALTER TYPE public.referral_payout_status OWNER TO postgres;

--
-- Name: txn_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.txn_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'expired'
);


ALTER TYPE public.txn_status OWNER TO postgres;

--
-- Name: user_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.user_role AS ENUM (
    'user',
    'admin'
);


ALTER TYPE public.user_role OWNER TO postgres;

--
-- Name: withdraw_method; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.withdraw_method AS ENUM (
    'phone',
    'qrcode'
);


ALTER TYPE public.withdraw_method OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: app_downloads; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.app_downloads (
    id integer NOT NULL,
    profile_id integer,
    device_type text,
    ip_address text,
    user_agent text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.app_downloads OWNER TO postgres;

--
-- Name: app_downloads_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.app_downloads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.app_downloads_id_seq OWNER TO postgres;

--
-- Name: app_downloads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.app_downloads_id_seq OWNED BY public.app_downloads.id;


--
-- Name: app_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.app_settings (
    key text NOT NULL,
    value text NOT NULL,
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.app_settings OWNER TO postgres;

--
-- Name: balance_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.balance_logs (
    id integer NOT NULL,
    profile_id integer NOT NULL,
    previous_balance numeric(10,2) NOT NULL,
    new_balance numeric(10,2) NOT NULL,
    change numeric(10,2) NOT NULL,
    action text NOT NULL,
    reference_id text,
    admin_id integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.balance_logs OWNER TO postgres;

--
-- Name: balance_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.balance_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.balance_logs_id_seq OWNER TO postgres;

--
-- Name: balance_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.balance_logs_id_seq OWNED BY public.balance_logs.id;


--
-- Name: blacklisted_users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.blacklisted_users (
    id integer NOT NULL,
    email text,
    phone text,
    first_name text,
    last_name text,
    date_of_birth text,
    id_document_url text,
    id_document_back_url text,
    selfie_url text,
    reason text DEFAULT 'Account deleted'::text NOT NULL,
    original_profile_id integer,
    reference_id text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.blacklisted_users OWNER TO postgres;

--
-- Name: blacklisted_users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.blacklisted_users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.blacklisted_users_id_seq OWNER TO postgres;

--
-- Name: blacklisted_users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.blacklisted_users_id_seq OWNED BY public.blacklisted_users.id;


--
-- Name: canalplus_subscriptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.canalplus_subscriptions (
    id integer NOT NULL,
    profile_id integer NOT NULL,
    plan_name text NOT NULL,
    plan_price_htg numeric(10,2) NOT NULL,
    plan_price_usdt numeric(10,4) NOT NULL,
    card_number character varying(14) NOT NULL,
    auto_renew boolean DEFAULT false NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.canalplus_subscriptions OWNER TO postgres;

--
-- Name: canalplus_subscriptions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.canalplus_subscriptions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.canalplus_subscriptions_id_seq OWNER TO postgres;

--
-- Name: canalplus_subscriptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.canalplus_subscriptions_id_seq OWNED BY public.canalplus_subscriptions.id;


--
-- Name: card_transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.card_transactions (
    id integer NOT NULL,
    card_id integer NOT NULL,
    profile_id integer NOT NULL,
    type text NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.card_transactions OWNER TO postgres;

--
-- Name: card_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.card_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.card_transactions_id_seq OWNER TO postgres;

--
-- Name: card_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.card_transactions_id_seq OWNED BY public.card_transactions.id;


--
-- Name: deposits; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.deposits (
    id integer NOT NULL,
    profile_id integer NOT NULL,
    amount_usdt numeric(10,2) NOT NULL,
    tx_hash text,
    status public.txn_status DEFAULT 'pending'::public.txn_status NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    deposit_method public.deposit_method DEFAULT 'usdt'::public.deposit_method NOT NULL,
    amount_htg numeric(12,2),
    moncash_transaction_id text,
    nowpayments_payment_id text,
    pay_address text,
    pay_currency text,
    receipt_id text,
    receipt_url text,
    expires_at timestamp without time zone,
    proof_image_url text,
    rejection_reason text,
    ip_address text,
    paypal_order_id text
);


ALTER TABLE public.deposits OWNER TO postgres;

--
-- Name: deposits_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.deposits_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.deposits_id_seq OWNER TO postgres;

--
-- Name: deposits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.deposits_id_seq OWNED BY public.deposits.id;


--
-- Name: fraud_rejections; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fraud_rejections (
    id integer NOT NULL,
    profile_id integer NOT NULL,
    deposit_id integer NOT NULL,
    admin_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.fraud_rejections OWNER TO postgres;

--
-- Name: fraud_rejections_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.fraud_rejections_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.fraud_rejections_id_seq OWNER TO postgres;

--
-- Name: fraud_rejections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.fraud_rejections_id_seq OWNED BY public.fraud_rejections.id;


--
-- Name: kyc_archives; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.kyc_archives (
    id integer NOT NULL,
    original_profile_id integer,
    reference_id text,
    full_name text,
    email text,
    phone text,
    date_of_birth text,
    country text,
    city text,
    id_type text,
    id_number text,
    address_line_1 text,
    id_document_url text,
    id_document_back_url text,
    selfie_url text,
    kyc_status_at_archive text,
    reason text NOT NULL,
    archived_by_admin_id integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.kyc_archives OWNER TO postgres;

--
-- Name: kyc_archives_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.kyc_archives_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.kyc_archives_id_seq OWNER TO postgres;

--
-- Name: kyc_archives_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.kyc_archives_id_seq OWNED BY public.kyc_archives.id;


--
-- Name: kyc_documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.kyc_documents (
    id integer NOT NULL,
    profile_id integer NOT NULL,
    id_document_url text,
    selfie_url text,
    submitted_at timestamp without time zone DEFAULT now() NOT NULL,
    id_document_back_url text,
    id_type text,
    id_number text,
    address_line_1 text
);


ALTER TABLE public.kyc_documents OWNER TO postgres;

--
-- Name: kyc_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.kyc_documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.kyc_documents_id_seq OWNER TO postgres;

--
-- Name: kyc_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.kyc_documents_id_seq OWNED BY public.kyc_documents.id;


--
-- Name: login_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.login_logs (
    id integer NOT NULL,
    profile_id integer NOT NULL,
    method text DEFAULT 'password'::text NOT NULL,
    ip_address text,
    login_at timestamp without time zone DEFAULT now() NOT NULL,
    device_info text
);


ALTER TABLE public.login_logs OWNER TO postgres;

--
-- Name: login_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.login_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.login_logs_id_seq OWNER TO postgres;

--
-- Name: login_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.login_logs_id_seq OWNED BY public.login_logs.id;


--
-- Name: merchant_transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.merchant_transactions (
    id integer NOT NULL,
    payment_id text NOT NULL,
    merchant_id integer NOT NULL,
    order_id text NOT NULL,
    amount numeric(14,2) NOT NULL,
    currency text NOT NULL,
    amount_usdt numeric(14,4) NOT NULL,
    amount_htg numeric(14,2) NOT NULL,
    fee_usdt numeric(14,4) NOT NULL,
    net_usdt numeric(14,4) NOT NULL,
    exchange_rate numeric(10,4) NOT NULL,
    status public.merchant_txn_status DEFAULT 'pending'::public.merchant_txn_status NOT NULL,
    payer_profile_id integer,
    success_url text,
    cancel_url text,
    description text,
    webhook_delivered boolean DEFAULT false NOT NULL,
    webhook_attempts integer DEFAULT 0 NOT NULL,
    paid_at timestamp without time zone,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.merchant_transactions OWNER TO postgres;

--
-- Name: merchant_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.merchant_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.merchant_transactions_id_seq OWNER TO postgres;

--
-- Name: merchant_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.merchant_transactions_id_seq OWNED BY public.merchant_transactions.id;


--
-- Name: merchants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.merchants (
    id integer NOT NULL,
    profile_id integer NOT NULL,
    business_name text NOT NULL,
    webhook_url text,
    api_public_key text NOT NULL,
    api_secret_key text NOT NULL,
    is_verified boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    balance numeric(14,4) DEFAULT 0 NOT NULL
);


ALTER TABLE public.merchants OWNER TO postgres;

--
-- Name: merchants_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.merchants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.merchants_id_seq OWNER TO postgres;

--
-- Name: merchants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.merchants_id_seq OWNED BY public.merchants.id;


--
-- Name: nfc_card_transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nfc_card_transactions (
    id integer NOT NULL,
    card_id integer NOT NULL,
    profile_id integer NOT NULL,
    type text NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    provider_tx_id text
);


ALTER TABLE public.nfc_card_transactions OWNER TO postgres;

--
-- Name: nfc_card_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.nfc_card_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.nfc_card_transactions_id_seq OWNER TO postgres;

--
-- Name: nfc_card_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.nfc_card_transactions_id_seq OWNED BY public.nfc_card_transactions.id;


--
-- Name: nfc_cards; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nfc_cards (
    id integer NOT NULL,
    profile_id integer NOT NULL,
    card_id text NOT NULL,
    name_on_card text NOT NULL,
    last4 text,
    brand text DEFAULT 'Visa'::text,
    status public.card_status DEFAULT 'pending'::public.card_status NOT NULL,
    nfc_balance numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    nfc_currency text DEFAULT 'USD'::text NOT NULL,
    card_detail jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    failed_attempts integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.nfc_cards OWNER TO postgres;

--
-- Name: nfc_cards_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.nfc_cards_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.nfc_cards_id_seq OWNER TO postgres;

--
-- Name: nfc_cards_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.nfc_cards_id_seq OWNED BY public.nfc_cards.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    profile_id integer NOT NULL,
    type public.notification_type NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notifications_id_seq OWNER TO postgres;

--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: otps; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.otps (
    id integer NOT NULL,
    profile_id integer NOT NULL,
    code text NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    verified boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    purpose text
);


ALTER TABLE public.otps OWNER TO postgres;

--
-- Name: otps_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.otps_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.otps_id_seq OWNER TO postgres;

--
-- Name: otps_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.otps_id_seq OWNED BY public.otps.id;


--
-- Name: p2p_ads; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.p2p_ads (
    id integer NOT NULL,
    seller_id integer NOT NULL,
    amount_usdt numeric(10,2) NOT NULL,
    available_usdt numeric(10,2) NOT NULL,
    rate_htg numeric(10,4),
    margin_pct numeric(5,2),
    currency text DEFAULT 'HTG'::text NOT NULL,
    country text DEFAULT 'HT'::text NOT NULL,
    payment_methods text[] DEFAULT '{}'::text[] NOT NULL,
    min_order_usdt numeric(10,2) DEFAULT 10 NOT NULL,
    max_order_usdt numeric(10,2),
    status text DEFAULT 'active'::text NOT NULL,
    terms_note text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.p2p_ads OWNER TO postgres;

--
-- Name: p2p_ads_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.p2p_ads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.p2p_ads_id_seq OWNER TO postgres;

--
-- Name: p2p_ads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.p2p_ads_id_seq OWNED BY public.p2p_ads.id;


--
-- Name: p2p_bans; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.p2p_bans (
    id integer NOT NULL,
    profile_id integer NOT NULL,
    banned_until timestamp without time zone NOT NULL,
    reason text DEFAULT '3 cancellations within 24 hours'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.p2p_bans OWNER TO postgres;

--
-- Name: p2p_bans_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.p2p_bans_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.p2p_bans_id_seq OWNER TO postgres;

--
-- Name: p2p_bans_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.p2p_bans_id_seq OWNED BY public.p2p_bans.id;


--
-- Name: p2p_cancellations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.p2p_cancellations (
    id integer NOT NULL,
    profile_id integer NOT NULL,
    order_id integer NOT NULL,
    role text NOT NULL,
    reason text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    buyer_confirmed_no_payment boolean DEFAULT false
);


ALTER TABLE public.p2p_cancellations OWNER TO postgres;

--
-- Name: p2p_cancellations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.p2p_cancellations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.p2p_cancellations_id_seq OWNER TO postgres;

--
-- Name: p2p_cancellations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.p2p_cancellations_id_seq OWNED BY public.p2p_cancellations.id;


--
-- Name: p2p_chat_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.p2p_chat_messages (
    id integer NOT NULL,
    order_id integer NOT NULL,
    sender_id integer NOT NULL,
    message text,
    file_url text,
    file_name text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    read_at timestamp without time zone,
    is_filtered boolean DEFAULT false,
    filter_reason text
);


ALTER TABLE public.p2p_chat_messages OWNER TO postgres;

--
-- Name: p2p_chat_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.p2p_chat_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.p2p_chat_messages_id_seq OWNER TO postgres;

--
-- Name: p2p_chat_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.p2p_chat_messages_id_seq OWNED BY public.p2p_chat_messages.id;


--
-- Name: p2p_dispute_actions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.p2p_dispute_actions (
    id integer NOT NULL,
    order_id integer NOT NULL,
    admin_id integer NOT NULL,
    action text NOT NULL,
    reason text NOT NULL,
    target_user_id integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.p2p_dispute_actions OWNER TO postgres;

--
-- Name: p2p_dispute_actions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.p2p_dispute_actions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.p2p_dispute_actions_id_seq OWNER TO postgres;

--
-- Name: p2p_dispute_actions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.p2p_dispute_actions_id_seq OWNED BY public.p2p_dispute_actions.id;


--
-- Name: p2p_orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.p2p_orders (
    id integer NOT NULL,
    order_id character varying(20),
    ad_id integer NOT NULL,
    buyer_id integer NOT NULL,
    seller_id integer NOT NULL,
    amount_usdt numeric(10,2) NOT NULL,
    amount_local numeric(12,2) NOT NULL,
    rate numeric(10,4) NOT NULL,
    currency text DEFAULT 'HTG'::text NOT NULL,
    payment_method text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    cancelled_by text,
    cancellation_reason text,
    dispute_reason text,
    seller_confirmed_receipt boolean DEFAULT false NOT NULL,
    paid_at timestamp without time zone,
    released_at timestamp without time zone,
    cancelled_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    expires_at timestamp without time zone,
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.p2p_orders OWNER TO postgres;

--
-- Name: p2p_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.p2p_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.p2p_orders_id_seq OWNER TO postgres;

--
-- Name: p2p_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.p2p_orders_id_seq OWNED BY public.p2p_orders.id;


--
-- Name: p2p_transfers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.p2p_transfers (
    id integer NOT NULL,
    sender_profile_id integer NOT NULL,
    receiver_profile_id integer NOT NULL,
    amount numeric(10,2) NOT NULL,
    note text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    transaction_id character varying(20),
    receipt_id text
);


ALTER TABLE public.p2p_transfers OWNER TO postgres;

--
-- Name: p2p_transfers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.p2p_transfers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.p2p_transfers_id_seq OWNER TO postgres;

--
-- Name: p2p_transfers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.p2p_transfers_id_seq OWNED BY public.p2p_transfers.id;


--
-- Name: payout_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payout_requests (
    id integer NOT NULL,
    user_id integer NOT NULL,
    merchant_id integer,
    amount numeric(14,4) NOT NULL,
    method public.payout_method NOT NULL,
    details jsonb NOT NULL,
    status public.payout_status DEFAULT 'pending'::public.payout_status NOT NULL,
    admin_note text,
    processed_at timestamp without time zone,
    processed_by integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.payout_requests OWNER TO postgres;

--
-- Name: payout_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.payout_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payout_requests_id_seq OWNER TO postgres;

--
-- Name: payout_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.payout_requests_id_seq OWNED BY public.payout_requests.id;


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profiles (
    id integer NOT NULL,
    full_name text NOT NULL,
    email text NOT NULL,
    role public.user_role DEFAULT 'user'::public.user_role NOT NULL,
    kyc_status public.kyc_status DEFAULT 'not_submitted'::public.kyc_status NOT NULL,
    balance numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    password_hash text NOT NULL,
    email_verified boolean DEFAULT false NOT NULL,
    two_factor_secret text,
    two_factor_enabled boolean DEFAULT false NOT NULL,
    phone text,
    first_name text,
    last_name text,
    date_of_birth text,
    country text,
    city text,
    is_banned boolean DEFAULT false NOT NULL,
    reference_id text,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp without time zone,
    pin_hash text,
    strowallet_customer_id text,
    can_edit_profile boolean DEFAULT false NOT NULL,
    frozen_until timestamp without time zone,
    withdrawal_pin_hash text,
    last_ip text,
    registration_ip text,
    last_login_at timestamp without time zone,
    trc20_deposit_address text,
    bep20_deposit_address text,
    affiliate_enabled boolean DEFAULT false NOT NULL,
    referral_code text,
    referral_balance numeric(10,2) DEFAULT 0 NOT NULL,
    referred_by_id integer,
    p2p_welcome_message text,
    p2p_seller_restricted boolean DEFAULT false,
    p2p_flagged_as text,
    p2p_merchant_name text,
    fcm_token text,
    fcm_token_updated_at timestamp without time zone,
    otp_blocked boolean DEFAULT false NOT NULL,
    last_activity timestamp without time zone,
    newsletter_subscribed boolean DEFAULT false NOT NULL,
    newsletter_subscribed_at timestamp without time zone,
    pending_email text,
    pending_phone text
);


ALTER TABLE public.profiles OWNER TO postgres;

--
-- Name: profiles_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.profiles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.profiles_id_seq OWNER TO postgres;

--
-- Name: profiles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.profiles_id_seq OWNED BY public.profiles.id;


--
-- Name: referral_earnings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.referral_earnings (
    id integer NOT NULL,
    referrer_id integer NOT NULL,
    referee_id integer NOT NULL,
    type public.referral_earning_type NOT NULL,
    amount numeric(10,2) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.referral_earnings OWNER TO postgres;

--
-- Name: referral_earnings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.referral_earnings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.referral_earnings_id_seq OWNER TO postgres;

--
-- Name: referral_earnings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.referral_earnings_id_seq OWNED BY public.referral_earnings.id;


--
-- Name: referral_payout_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.referral_payout_requests (
    id integer NOT NULL,
    profile_id integer NOT NULL,
    amount numeric(10,2) NOT NULL,
    status public.referral_payout_status DEFAULT 'pending'::public.referral_payout_status NOT NULL,
    admin_note text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp without time zone
);


ALTER TABLE public.referral_payout_requests OWNER TO postgres;

--
-- Name: referral_payout_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.referral_payout_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.referral_payout_requests_id_seq OWNER TO postgres;

--
-- Name: referral_payout_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.referral_payout_requests_id_seq OWNED BY public.referral_payout_requests.id;


--
-- Name: security_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.security_events (
    id integer NOT NULL,
    profile_id integer,
    event_type text NOT NULL,
    ip_address text,
    device_info text,
    details text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'info'::text
);


ALTER TABLE public.security_events OWNER TO postgres;

--
-- Name: security_events_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.security_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.security_events_id_seq OWNER TO postgres;

--
-- Name: security_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.security_events_id_seq OWNED BY public.security_events.id;


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sessions (
    sid character varying NOT NULL,
    sess jsonb NOT NULL,
    expire timestamp without time zone NOT NULL
);


ALTER TABLE public.sessions OWNER TO postgres;

--
-- Name: support_conversations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.support_conversations (
    id integer NOT NULL,
    profile_id integer NOT NULL,
    status public.chat_status DEFAULT 'active'::public.chat_status NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    rating integer,
    closed_by text
);


ALTER TABLE public.support_conversations OWNER TO postgres;

--
-- Name: support_conversations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.support_conversations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.support_conversations_id_seq OWNER TO postgres;

--
-- Name: support_conversations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.support_conversations_id_seq OWNED BY public.support_conversations.id;


--
-- Name: support_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.support_messages (
    id integer NOT NULL,
    conversation_id integer NOT NULL,
    sender public.chat_sender NOT NULL,
    sender_profile_id integer,
    message text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    file_url text,
    file_name text
);


ALTER TABLE public.support_messages OWNER TO postgres;

--
-- Name: support_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.support_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.support_messages_id_seq OWNER TO postgres;

--
-- Name: support_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.support_messages_id_seq OWNED BY public.support_messages.id;


--
-- Name: support_quick_replies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.support_quick_replies (
    id integer NOT NULL,
    shortcut text NOT NULL,
    label text NOT NULL,
    message text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.support_quick_replies OWNER TO postgres;

--
-- Name: support_quick_replies_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.support_quick_replies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.support_quick_replies_id_seq OWNER TO postgres;

--
-- Name: support_quick_replies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.support_quick_replies_id_seq OWNED BY public.support_quick_replies.id;


--
-- Name: top_up_transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.top_up_transactions (
    id integer NOT NULL,
    profile_id integer NOT NULL,
    operator_id text NOT NULL,
    operator_name text NOT NULL,
    phone text NOT NULL,
    amount_usd numeric(10,2) NOT NULL,
    transaction_id text,
    status text DEFAULT 'success'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.top_up_transactions OWNER TO postgres;

--
-- Name: top_up_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.top_up_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.top_up_transactions_id_seq OWNER TO postgres;

--
-- Name: top_up_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.top_up_transactions_id_seq OWNED BY public.top_up_transactions.id;


--
-- Name: user_reports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_reports (
    id integer NOT NULL,
    reporter_profile_id integer NOT NULL,
    reported_identifier text NOT NULL,
    reported_profile_id integer,
    reason text NOT NULL,
    description text NOT NULL,
    proof_image_url text,
    status text DEFAULT 'pending'::text NOT NULL,
    admin_note text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp without time zone
);


ALTER TABLE public.user_reports OWNER TO postgres;

--
-- Name: user_reports_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_reports_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_reports_id_seq OWNER TO postgres;

--
-- Name: user_reports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_reports_id_seq OWNED BY public.user_reports.id;


--
-- Name: virtual_cards; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.virtual_cards (
    id integer NOT NULL,
    profile_id integer NOT NULL,
    card_id text NOT NULL,
    card_type text DEFAULT 'visa'::text NOT NULL,
    name_on_card text NOT NULL,
    last4 text,
    brand text DEFAULT 'Visa'::text,
    status public.card_status DEFAULT 'pending'::public.card_status NOT NULL,
    card_balance numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    card_currency text DEFAULT 'USD'::text NOT NULL,
    card_detail jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.virtual_cards OWNER TO postgres;

--
-- Name: virtual_cards_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.virtual_cards_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.virtual_cards_id_seq OWNER TO postgres;

--
-- Name: virtual_cards_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.virtual_cards_id_seq OWNED BY public.virtual_cards.id;


--
-- Name: webauthn_credentials; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.webauthn_credentials (
    id integer NOT NULL,
    profile_id integer NOT NULL,
    credential_id text NOT NULL,
    public_key text NOT NULL,
    counter integer DEFAULT 0 NOT NULL,
    device_name text DEFAULT 'Fingerprint'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.webauthn_credentials OWNER TO postgres;

--
-- Name: webauthn_credentials_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.webauthn_credentials_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.webauthn_credentials_id_seq OWNER TO postgres;

--
-- Name: webauthn_credentials_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.webauthn_credentials_id_seq OWNED BY public.webauthn_credentials.id;


--
-- Name: webhook_dedup; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.webhook_dedup (
    event_key text NOT NULL,
    source text DEFAULT 'strowallet'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.webhook_dedup OWNER TO postgres;

--
-- Name: withdrawals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.withdrawals (
    id integer NOT NULL,
    profile_id integer NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency public.currency NOT NULL,
    phone_number text,
    status public.txn_status DEFAULT 'pending'::public.txn_status NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    withdraw_method public.withdraw_method DEFAULT 'phone'::public.withdraw_method NOT NULL,
    qr_code_url text,
    receipt_id text,
    receipt_url text,
    trc_address text,
    fee numeric(10,2) DEFAULT 2.50,
    ip_address text
);


ALTER TABLE public.withdrawals OWNER TO postgres;

--
-- Name: withdrawals_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.withdrawals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.withdrawals_id_seq OWNER TO postgres;

--
-- Name: withdrawals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.withdrawals_id_seq OWNED BY public.withdrawals.id;


--
-- Name: app_downloads id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_downloads ALTER COLUMN id SET DEFAULT nextval('public.app_downloads_id_seq'::regclass);


--
-- Name: balance_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.balance_logs ALTER COLUMN id SET DEFAULT nextval('public.balance_logs_id_seq'::regclass);


--
-- Name: blacklisted_users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blacklisted_users ALTER COLUMN id SET DEFAULT nextval('public.blacklisted_users_id_seq'::regclass);


--
-- Name: canalplus_subscriptions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.canalplus_subscriptions ALTER COLUMN id SET DEFAULT nextval('public.canalplus_subscriptions_id_seq'::regclass);


--
-- Name: card_transactions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.card_transactions ALTER COLUMN id SET DEFAULT nextval('public.card_transactions_id_seq'::regclass);


--
-- Name: deposits id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deposits ALTER COLUMN id SET DEFAULT nextval('public.deposits_id_seq'::regclass);


--
-- Name: fraud_rejections id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fraud_rejections ALTER COLUMN id SET DEFAULT nextval('public.fraud_rejections_id_seq'::regclass);


--
-- Name: kyc_archives id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kyc_archives ALTER COLUMN id SET DEFAULT nextval('public.kyc_archives_id_seq'::regclass);


--
-- Name: kyc_documents id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kyc_documents ALTER COLUMN id SET DEFAULT nextval('public.kyc_documents_id_seq'::regclass);


--
-- Name: login_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.login_logs ALTER COLUMN id SET DEFAULT nextval('public.login_logs_id_seq'::regclass);


--
-- Name: merchant_transactions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.merchant_transactions ALTER COLUMN id SET DEFAULT nextval('public.merchant_transactions_id_seq'::regclass);


--
-- Name: merchants id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.merchants ALTER COLUMN id SET DEFAULT nextval('public.merchants_id_seq'::regclass);


--
-- Name: nfc_card_transactions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nfc_card_transactions ALTER COLUMN id SET DEFAULT nextval('public.nfc_card_transactions_id_seq'::regclass);


--
-- Name: nfc_cards id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nfc_cards ALTER COLUMN id SET DEFAULT nextval('public.nfc_cards_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: otps id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.otps ALTER COLUMN id SET DEFAULT nextval('public.otps_id_seq'::regclass);


--
-- Name: p2p_ads id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.p2p_ads ALTER COLUMN id SET DEFAULT nextval('public.p2p_ads_id_seq'::regclass);


--
-- Name: p2p_bans id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.p2p_bans ALTER COLUMN id SET DEFAULT nextval('public.p2p_bans_id_seq'::regclass);


--
-- Name: p2p_cancellations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.p2p_cancellations ALTER COLUMN id SET DEFAULT nextval('public.p2p_cancellations_id_seq'::regclass);


--
-- Name: p2p_chat_messages id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.p2p_chat_messages ALTER COLUMN id SET DEFAULT nextval('public.p2p_chat_messages_id_seq'::regclass);


--
-- Name: p2p_dispute_actions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.p2p_dispute_actions ALTER COLUMN id SET DEFAULT nextval('public.p2p_dispute_actions_id_seq'::regclass);


--
-- Name: p2p_orders id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.p2p_orders ALTER COLUMN id SET DEFAULT nextval('public.p2p_orders_id_seq'::regclass);


--
-- Name: p2p_transfers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.p2p_transfers ALTER COLUMN id SET DEFAULT nextval('public.p2p_transfers_id_seq'::regclass);


--
-- Name: payout_requests id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payout_requests ALTER COLUMN id SET DEFAULT nextval('public.payout_requests_id_seq'::regclass);


--
-- Name: profiles id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles ALTER COLUMN id SET DEFAULT nextval('public.profiles_id_seq'::regclass);


--
-- Name: referral_earnings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.referral_earnings ALTER COLUMN id SET DEFAULT nextval('public.referral_earnings_id_seq'::regclass);


--
-- Name: referral_payout_requests id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.referral_payout_requests ALTER COLUMN id SET DEFAULT nextval('public.referral_payout_requests_id_seq'::regclass);


--
-- Name: security_events id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.security_events ALTER COLUMN id SET DEFAULT nextval('public.security_events_id_seq'::regclass);


--
-- Name: support_conversations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_conversations ALTER COLUMN id SET DEFAULT nextval('public.support_conversations_id_seq'::regclass);


--
-- Name: support_messages id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_messages ALTER COLUMN id SET DEFAULT nextval('public.support_messages_id_seq'::regclass);


--
-- Name: support_quick_replies id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_quick_replies ALTER COLUMN id SET DEFAULT nextval('public.support_quick_replies_id_seq'::regclass);


--
-- Name: top_up_transactions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.top_up_transactions ALTER COLUMN id SET DEFAULT nextval('public.top_up_transactions_id_seq'::regclass);


--
-- Name: user_reports id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_reports ALTER COLUMN id SET DEFAULT nextval('public.user_reports_id_seq'::regclass);


--
-- Name: virtual_cards id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.virtual_cards ALTER COLUMN id SET DEFAULT nextval('public.virtual_cards_id_seq'::regclass);


--
-- Name: webauthn_credentials id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.webauthn_credentials ALTER COLUMN id SET DEFAULT nextval('public.webauthn_credentials_id_seq'::regclass);


--
-- Name: withdrawals id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.withdrawals ALTER COLUMN id SET DEFAULT nextval('public.withdrawals_id_seq'::regclass);


--
-- Data for Name: app_downloads; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.app_downloads (id, profile_id, device_type, ip_address, user_agent, created_at) FROM stdin;
1	1	desktop	34.127.44.131	Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36	2026-04-14 04:17:30.847771
2	\N	desktop	127.0.0.1	curl/8.14.1	2026-06-20 04:37:20.556235
\.


--
-- Data for Name: app_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.app_settings (key, value, updated_at) FROM stdin;
deposit_rate	143	2026-04-03 00:30:27.83588
withdrawal_rate	139	2026-04-03 00:30:27.83588
ip_cleanup_v1_done	true	2026-04-08 22:46:40.978261
moncash_phone	509-3333-1111	2026-04-14 16:53:08.669728
natcash_phone	509-4444-2222	2026-04-14 16:53:08.672521
\.


--
-- Data for Name: balance_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.balance_logs (id, profile_id, previous_balance, new_balance, change, action, reference_id, admin_id, created_at) FROM stdin;
1	1	875.00	825.00	-50.00	p2p_ad_lock	1	\N	2026-04-13 07:04:22.887127
2	4	1046.00	1096.00	50.00	p2p_admin_refund	1	\N	2026-04-13 16:05:26.338044
3	1	859.34	844.34	-15.00	p2p_ad_lock	3	\N	2026-04-17 04:26:29.375644
\.


--
-- Data for Name: blacklisted_users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.blacklisted_users (id, email, phone, first_name, last_name, date_of_birth, id_document_url, id_document_back_url, selfie_url, reason, original_profile_id, reference_id, created_at) FROM stdin;
\.


--
-- Data for Name: canalplus_subscriptions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.canalplus_subscriptions (id, profile_id, plan_name, plan_price_htg, plan_price_usdt, card_number, auto_renew, status, created_at) FROM stdin;
1	1	Acces	790.00	5.5245	12345678901234	t	success	2026-04-16 05:12:27.223507
2	1	Acces	790.00	5.5245	12345678901234	f	success	2026-04-16 05:29:06.111571
3	1	Evasion	1850.00	12.9370	98765432109876	f	failed	2026-04-16 05:30:23.01305
4	1	ToutCanal+	3850.00	26.9231	11112222333344	f	failed	2026-04-16 05:31:17.12031
\.


--
-- Data for Name: card_transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.card_transactions (id, card_id, profile_id, type, amount, currency, description, created_at) FROM stdin;
1	2	1	fund	20.00	USD	Card funded — $20.00 USD added	2026-03-28 04:26:26.965967
\.


--
-- Data for Name: deposits; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.deposits (id, profile_id, amount_usdt, tx_hash, status, created_at, deposit_method, amount_htg, moncash_transaction_id, nowpayments_payment_id, pay_address, pay_currency, receipt_id, receipt_url, expires_at, proof_image_url, rejection_reason, ip_address, paypal_order_id) FROM stdin;
1	3	50.00	test_hash_VZ5qQZ2_	approved	2026-02-10 05:57:52.466728	usdt	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
2	4	25.00	Gjdbjjhvvffuibvkjg	approved	2026-02-10 06:02:49.386739	usdt	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4	4	120.00	Jgkfdzjjjdfbdsg	approved	2026-02-11 07:42:24.234561	usdt	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
3	4	1.00	Ghfjdffhhhfzsdkbd	approved	2026-02-11 07:39:51.059386	usdt	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5	1	100.00	NP-1-1771004279077	pending	2026-02-13 17:37:59.60942	nowpayments	13950.00	\N	5428188557	TEHHEttAPX9jmcF3LQY7KMimkbtdY6TzUX	usdttrc20	\N	\N	\N	\N	\N	\N	\N
6	1	10.00	NP-1-1771004394553	pending	2026-02-13 17:39:55.483525	nowpayments	1395.00	\N	6270857395	TMAnCH9P1GqUzs9R81J1cohMNh5XE7wpaN	usdttrc20	\N	\N	\N	\N	\N	\N	\N
7	1	15.00	NP-1-1773518678076	rejected	2026-03-14 20:04:39.094871	nowpayments	2057.63	\N	4661243380	0x69164933d9148B1a8d090244BbadF973B62409C2	usdtbsc	\N	\N	\N	\N	\N	\N	\N
11	26	20.00	1S494772JD0400409	pending	2026-05-13 17:42:09.25187	paypal	2860.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	34.182.20.110	1S494772JD0400409
\.


--
-- Data for Name: fraud_rejections; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.fraud_rejections (id, profile_id, deposit_id, admin_id, created_at) FROM stdin;
\.


--
-- Data for Name: kyc_archives; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.kyc_archives (id, original_profile_id, reference_id, full_name, email, phone, date_of_birth, country, city, id_type, id_number, address_line_1, id_document_url, id_document_back_url, selfie_url, kyc_status_at_archive, reason, archived_by_admin_id, created_at) FROM stdin;
\.


--
-- Data for Name: kyc_documents; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.kyc_documents (id, profile_id, id_document_url, selfie_url, submitted_at, id_document_back_url, id_type, id_number, address_line_1) FROM stdin;
1	1	/objects/uploads/a6c167e9-8231-4276-a07f-0e6beb3e97d4	/objects/uploads/0d017ac1-1f3f-4384-98aa-61e66caefabc	2026-02-10 05:31:55.79882	\N	\N	\N	\N
2	4	/objects/uploads/a5f77323-d1bf-42c8-a6ec-49c3ce12fd22	/objects/uploads/9925a962-df66-4071-b987-72db14bce6b5	2026-02-10 14:34:31.514059	/objects/uploads/ee9afe0f-8e30-4bb9-9926-e26dd7c12503	\N	\N	\N
\.


--
-- Data for Name: login_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.login_logs (id, profile_id, method, ip_address, login_at, device_info) FROM stdin;
1	1	password	\N	2026-03-14 20:03:08.371858	\N
2	1	password	\N	2026-03-23 21:39:44.685432	\N
3	1	password	\N	2026-03-24 14:33:30.10064	\N
4	22	password	\N	2026-03-26 22:46:17.235619	\N
5	21	password	\N	2026-03-26 22:46:58.563106	\N
6	1	password	\N	2026-03-28 04:27:07.63324	\N
7	1	password	\N	2026-03-30 03:15:50.517079	\N
8	1	password	\N	2026-03-30 03:21:53.083711	\N
9	1	password	\N	2026-03-30 03:24:44.068324	\N
10	1	password	\N	2026-03-30 03:31:20.060126	\N
11	1	password	\N	2026-03-30 03:45:07.193601	\N
12	1	password	\N	2026-04-03 13:43:11.95552	\N
13	1	password	\N	2026-04-03 13:47:06.164731	\N
14	1	password	\N	2026-04-03 13:48:26.737453	\N
15	1	password	\N	2026-04-03 13:48:42.823957	\N
16	1	password	\N	2026-04-03 13:48:57.648555	\N
17	1	password	\N	2026-04-03 13:56:31.440009	\N
18	1	password	\N	2026-04-03 14:02:03.543869	\N
19	1	password	\N	2026-04-03 14:03:53.261283	\N
20	1	password	\N	2026-04-08 03:46:00.850584	\N
21	1	password	\N	2026-04-08 03:47:39.972872	\N
22	1	password	\N	2026-04-08 03:57:58.19559	\N
23	1	password	\N	2026-04-08 04:11:08.050727	\N
24	1	password	\N	2026-04-08 04:12:32.34606	\N
25	1	password	\N	2026-04-08 04:14:46.098671	\N
26	1	password	\N	2026-04-08 04:17:58.004423	\N
27	1	password	\N	2026-04-08 04:28:33.636635	\N
28	1	password	\N	2026-04-08 04:31:04.095125	\N
29	1	password	\N	2026-04-08 05:09:30.827424	\N
30	1	password	\N	2026-04-08 05:35:14.802689	\N
31	1	password	34.82.39.183	2026-04-13 06:51:39.987954	\N
32	1	password	34.82.39.183	2026-04-13 06:54:02.37906	\N
33	1	password	34.82.39.183	2026-04-13 06:55:38.835652	\N
34	1	password	34.82.39.183	2026-04-13 06:59:54.078737	\N
35	1	password	34.82.39.183	2026-04-13 07:01:49.901309	\N
36	1	password	34.82.39.183	2026-04-13 07:03:44.240199	\N
37	1	password	34.187.143.160	2026-04-13 15:46:58.547329	\N
38	1	password	34.187.143.160	2026-04-13 15:51:02.790052	\N
39	2	password	192.168.1.45	2026-04-13 14:01:59.64835	Chrome Mobile / iPhone iOS 17.0
40	2	password	192.168.1.45	2026-04-13 11:01:59.64835	Chrome Mobile / iPhone iOS 17.0
41	4	password	10.0.0.22	2026-04-13 15:01:59.64835	Chrome 122 / Windows 10 x64
42	4	password	10.0.0.22	2026-04-13 13:01:59.64835	Chrome 122 / Windows 10 x64
43	1	password	34.187.143.160	2026-04-13 16:02:46.799096	\N
44	1	password	34.187.143.160	2026-04-13 16:04:27.029493	\N
45	1	password	34.187.143.160	2026-04-13 16:13:12.83125	\N
46	1	password	34.187.143.160	2026-04-13 16:31:02.555546	\N
47	1	password	34.187.143.160	2026-04-13 16:34:54.383633	\N
48	1	password	35.233.252.253	2026-04-13 17:11:13.481103	\N
49	1	password	35.233.252.253	2026-04-13 17:29:45.059465	\N
50	1	password	35.233.252.253	2026-04-13 17:31:46.988999	\N
51	1	password	35.233.252.253	2026-04-13 17:38:55.796142	\N
52	1	password	34.127.44.131	2026-04-14 04:17:14.496821	\N
53	1	password	35.247.112.151	2026-04-14 16:52:35.192585	\N
54	1	password	35.197.100.10	2026-04-16 05:11:41.871099	\N
55	1	password	35.197.100.10	2026-04-16 05:23:48.742058	\N
56	1	password	127.0.0.1	2026-04-16 05:30:02.103188	\N
57	1	password	127.0.0.1	2026-04-16 05:30:55.723016	\N
58	1	password	127.0.0.1	2026-04-17 04:23:47.405565	\N
59	1	password	127.0.0.1	2026-04-17 04:26:29.291808	\N
60	1	password	127.0.0.1	2026-04-18 14:03:33.636588	\N
61	1	password	127.0.0.1	2026-04-18 14:35:31.257503	\N
62	1	password	127.0.0.1	2026-04-18 14:42:04.774523	\N
63	1	password	127.0.0.1	2026-04-18 15:24:19.268287	\N
64	1	password	34.168.252.189	2026-04-19 01:20:43.292501	\N
65	1	password	34.169.14.252	2026-04-20 16:20:50.117737	\N
66	1	password	34.169.14.252	2026-04-20 16:22:56.247857	\N
67	21	password	34.169.14.252	2026-04-20 16:23:37.583115	\N
68	1	password	34.53.51.201	2026-04-20 19:00:09.525632	\N
69	21	password	34.53.51.201	2026-04-20 19:00:50.253957	\N
70	21	password	127.0.0.1	2026-04-20 19:01:20.466904	\N
71	21	password	127.0.0.1	2026-04-20 19:04:14.451503	\N
72	23	password	35.252.128.66	2026-05-12 09:06:56.706504	\N
74	25	password	34.182.20.110	2026-05-13 17:38:12.484613	\N
75	26	password	34.182.20.110	2026-05-13 17:42:00.726999	\N
76	27	password	35.230.31.22	2026-06-22 04:43:56.01218	\N
77	28	password	35.230.31.22	2026-06-22 04:46:20.691809	\N
78	29	password	35.230.31.22	2026-06-22 04:47:36.884208	\N
79	1	password	200.113.251.0	2026-07-15 15:19:13.047698	\N
80	1	password	200.113.230.15	2026-07-24 20:40:43.634258	\N
\.


--
-- Data for Name: merchant_transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.merchant_transactions (id, payment_id, merchant_id, order_id, amount, currency, amount_usdt, amount_htg, fee_usdt, net_usdt, exchange_rate, status, payer_profile_id, success_url, cancel_url, description, webhook_delivered, webhook_attempts, paid_at, expires_at, created_at) FROM stdin;
2	pay_04556ae1decde35fb986cb1e5cd3	1	BUYER-TEST-001	500.00	HTG	3.4965	500.00	0.0524	3.4441	143.0000	completed	21	http://example.com/success	\N	Buyer test purchase	f	0	2026-04-20 16:23:49.758	2026-04-20 16:53:16.35	2026-04-20 16:23:16.35139
5	pay_7f8f82121c20a137c012df7f74ee	1	FINAL-VERIFY-001	250.00	HTG	1.7483	250.00	0.0262	1.7221	143.0000	completed	21	\N	\N	Final verify	f	0	2026-04-20 19:01:33.812	2026-04-20 19:30:29.299	2026-04-20 19:00:29.301132
7	pay_a283b6f6a3bed2babff8898433c5	1	TG-FIRE-001	120.00	HTG	0.8392	120.00	0.0126	0.8266	143.0000	completed	21	\N	\N	Telegram fire	f	0	2026-04-20 19:04:14.549	2026-04-20 19:33:54.032	2026-04-20 19:03:54.033958
1	pay_39454388d9e65e5b6b5f91e913c9	1	TEST-ORDER-001	1000.00	HTG	6.9930	1000.00	0.1049	6.8881	143.0000	expired	\N	http://example.com/thanks	\N	Test purchase	f	0	\N	2026-04-20 16:51:21.05	2026-04-20 16:21:21.0517
3	pay_14e3d4c469175d4228c1d60f3048	1	URL-FIX-TEST-1	300.00	HTG	2.0979	300.00	0.0315	2.0664	143.0000	expired	\N	\N	\N	test	f	0	\N	2026-04-20 19:28:54.991	2026-04-20 18:58:54.993994
4	pay_1a59405a01b10ad2114276141f79	1	URL-FIX-TEST-1	300.00	HTG	2.0979	300.00	0.0315	2.0664	143.0000	expired	\N	\N	\N	test	f	0	\N	2026-04-20 19:29:03.683	2026-04-20 18:59:03.68437
6	pay_7fd8a2e955d284201ceb63277728	1	TG-TEST-001	175.00	HTG	1.2238	175.00	0.0184	1.2054	143.0000	expired	\N	\N	\N	Telegram split test	f	0	\N	2026-04-20 19:32:30.885	2026-04-20 19:02:30.888225
\.


--
-- Data for Name: merchants; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.merchants (id, profile_id, business_name, webhook_url, api_public_key, api_secret_key, is_verified, created_at, balance) FROM stdin;
1	1	Test Store	\N	izi_pk_ae30e7ee23d946f970380bec46ad1a476d9a	izi_sk_2580efecb1be4b393344292c2756d0517b648f5c0df96cd0fc693ba5	f	2026-04-20 16:21:07.920629	0.0000
\.


--
-- Data for Name: nfc_card_transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nfc_card_transactions (id, card_id, profile_id, type, amount, currency, description, created_at, provider_tx_id) FROM stdin;
\.


--
-- Data for Name: nfc_cards; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nfc_cards (id, profile_id, card_id, name_on_card, last4, brand, status, nfc_balance, nfc_currency, card_detail, created_at, failed_attempts) FROM stdin;
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.notifications (id, profile_id, type, title, message, is_read, created_at) FROM stdin;
1	4	custom_message	You need to send the money back (test)	Hey we sorry this is a test message 	t	2026-02-11 08:00:06.31671
2	4	deposit_approved	Deposit Approved	Your deposit of 120.00 USDT (16,740.00 HTG) has been approved and added to your balance.	t	2026-02-11 08:00:47.758182
3	4	deposit_approved	Deposit Approved	Your deposit of 1.00 USDT (139.50 HTG) has been approved and added to your balance.	t	2026-02-11 08:00:49.473685
4	4	transfer_received	Funds Received	You received 900.00 USDT from Wilgentz - "For you"	f	2026-02-15 18:25:37.772134
6	4	transfer_received	Funds Received	You received 25.00 USDT from Wilgentz - "Gift"	f	2026-02-15 18:26:27.186859
5	1	transfer_sent	Funds Sent	You sent 900.00 USDT to Pierre Wilgentz	t	2026-02-15 18:25:37.774986
7	1	transfer_sent	Funds Sent	You sent 25.00 USDT to Pierre Wilgentz	t	2026-02-15 18:26:27.189797
8	15	custom_message	Virtual card maintenance 	Our virtual on pause now	f	2026-03-12 02:27:56.904609
9	1	deposit_rejected	Deposit Rejected	Your deposit of 15.00 USDT has been rejected. Please contact support for more information.	t	2026-03-14 20:06:13.872598
10	1	custom_message	Virtual Card Ready	Your virtual card is now active and ready to use.	f	2026-03-17 23:02:06.86038
11	1	custom_message	Virtual Card Ready	Your virtual card is now active and ready to use.	f	2026-03-19 18:34:43.805288
12	1	custom_message	Virtual Card Ready	Your virtual card is now active and ready to use.	f	2026-03-19 19:03:59.637357
13	1	custom_message	Card Transaction	A transaction of 5.99 USD was processed on your virtual card.	f	2026-03-19 19:03:59.704079
14	17	custom_message	Virtual Card Request Cancelled — Refund Issued	Your virtual card application was cancelled by support. $20.00 USDT has been refunded to your balance. You can apply for a new card anytime.	f	2026-03-23 21:40:14.037745
15	22	deposit_rejected	⚠️ Deposit Rejected — Fraud Warning	Your deposit of 14.34 USDT was rejected. Reason: Fraudulent or invalid payment proof. This is warning 1/3 — further violations will result in account suspension.	f	2026-03-26 22:47:29.814227
16	2	custom_message	Account Flagged	Admin review: flagging and restricting both parties while resolving dispute	f	2026-04-13 16:05:03.109438
17	4	custom_message	P2P Selling Restricted	Admin review: flagging and restricting both parties while resolving dispute	f	2026-04-13 16:05:08.72427
18	2	custom_message	Account Frozen	Admin review: flagging and restricting both parties while resolving dispute	f	2026-04-13 16:05:14.588972
19	4	custom_message	Dispute Resolved — Funds Refunded	Admin review: flagging and restricting both parties while resolving dispute	f	2026-04-13 16:05:26.363159
20	2	custom_message	Dispute Resolved — Funds Returned to Seller	Admin review: flagging and restricting both parties while resolving dispute	f	2026-04-13 16:05:26.366501
21	1	transfer_received	💸 Izichanj Pay — Payment Received	Test Fraud Admin paid 3.50 USDT for order BUYER-TEST-001. Net credited: 3.44 USDT (after 1.5% fee).	f	2026-04-20 16:23:49.764595
22	21	transfer_sent	✅ Payment Successful	You paid 3.50 USDT to Test Store (order BUYER-TEST-001).	f	2026-04-20 16:23:49.765301
23	1	transfer_received	💸 Izichanj Pay — Payment Received	Test Fraud Admin paid 1.75 USDT for order FINAL-VERIFY-001. Net credited: 1.72 USDT (after 1.5% fee).	f	2026-04-20 19:01:33.847356
24	21	transfer_sent	✅ Payment Successful	You paid 1.75 USDT to Test Store (order FINAL-VERIFY-001).	f	2026-04-20 19:01:33.847206
25	1	transfer_received	💸 Izichanj Pay — Payment Received	Test Fraud Admin paid 0.84 USDT for order TG-FIRE-001. Net credited: 0.83 USDT (after 1.5% fee).	f	2026-04-20 19:04:14.580735
26	21	transfer_sent	✅ Payment Successful	You paid 0.84 USDT to Test Store (order TG-FIRE-001).	f	2026-04-20 19:04:14.580848
\.


--
-- Data for Name: otps; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.otps (id, profile_id, code, expires_at, verified, created_at, purpose) FROM stdin;
10	11	422022	2026-02-11 08:51:37.63	f	2026-02-11 08:46:37.630781	\N
11	12	318657	2026-02-11 08:52:30.632	f	2026-02-11 08:47:30.633345	\N
12	4	145632	2026-02-11 09:11:38.92	f	2026-02-11 09:06:38.921712	\N
13	4	458834	2026-02-11 09:11:46.055	f	2026-02-11 09:06:46.055929	\N
14	4	292553	2026-02-11 09:11:51.648	f	2026-02-11 09:06:51.64931	\N
15	4	531435	2026-02-11 09:12:06.603	f	2026-02-11 09:07:06.603615	\N
16	4	670721	2026-02-11 09:12:21.679	f	2026-02-11 09:07:21.679865	\N
17	13	436723	2026-02-11 16:46:08.789	f	2026-02-11 16:41:08.790273	\N
18	13	515814	2026-02-11 16:46:24.824	f	2026-02-11 16:41:24.824539	\N
19	13	454997	2026-02-11 16:50:52.529	f	2026-02-11 16:45:52.530228	\N
20	13	716743	2026-02-11 17:02:07.61	t	2026-02-11 16:57:07.611438	\N
21	14	751416	2026-02-11 17:33:34.211	t	2026-02-11 17:28:34.211833	\N
22	15	476507	2026-02-11 20:33:07.129	t	2026-02-11 20:28:07.129882	\N
23	15	330295	2026-02-12 14:00:08.082	t	2026-02-12 13:55:08.084235	\N
24	4	624226	2026-02-12 14:06:40.409	f	2026-02-12 14:01:40.410014	\N
25	4	985304	2026-02-12 14:08:06.152	f	2026-02-12 14:03:06.153298	\N
26	15	175274	2026-02-16 18:37:47.735	f	2026-02-16 18:32:47.736986	\N
27	16	455255	2026-02-16 18:51:49.316	f	2026-02-16 18:46:49.317255	\N
28	17	369383	2026-02-16 19:00:53.979	f	2026-02-16 18:55:53.980152	\N
29	18	471560	2026-02-16 19:33:55.954	f	2026-02-16 19:28:55.954834	\N
30	19	785273	2026-02-16 19:38:08.684	f	2026-02-16 19:33:08.685254	\N
31	18	651932	2026-02-16 19:54:00.197	f	2026-02-16 19:49:00.198298	\N
32	16	993203	2026-02-16 22:15:07.334	t	2026-02-16 22:10:07.336172	\N
33	20	488765	2026-03-14 04:26:07.748	f	2026-03-14 04:21:07.748919	\N
34	1	960916	2026-04-08 04:21:12.471	f	2026-04-08 04:16:12.472146	\N
35	27	428627	2026-06-22 04:48:44.423	f	2026-06-22 04:43:44.444536	\N
36	28	924006	2026-06-22 04:51:08.579	f	2026-06-22 04:46:08.609788	\N
37	29	185273	2026-06-22 04:52:23.77	f	2026-06-22 04:47:23.782271	\N
\.


--
-- Data for Name: p2p_ads; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.p2p_ads (id, seller_id, amount_usdt, available_usdt, rate_htg, margin_pct, currency, country, payment_methods, min_order_usdt, max_order_usdt, status, terms_note, created_at, updated_at) FROM stdin;
1	1	50.00	50.00	140.0000	\N	HTG	HT	{PayPal}	10.00	50.00	active	\N	2026-04-13 07:04:22.882139	2026-04-13 07:04:22.882139
2	4	100.00	90.00	142.0000	0.00	HTG	Haiti	{MonCash}	10.00	100.00	active	Test ad for dispute	2026-04-13 16:01:09.908307	2026-04-17 04:23:47.496064
3	1	15.00	15.00	143.0000	\N	HTG	HT	{MonCash,NatCash}	5.00	15.00	active	Test ad	2026-04-17 04:26:29.371499	2026-04-17 04:26:29.371499
\.


--
-- Data for Name: p2p_bans; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.p2p_bans (id, profile_id, banned_until, reason, created_at) FROM stdin;
\.


--
-- Data for Name: p2p_cancellations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.p2p_cancellations (id, profile_id, order_id, role, reason, created_at, buyer_confirmed_no_payment) FROM stdin;
\.


--
-- Data for Name: p2p_chat_messages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.p2p_chat_messages (id, order_id, sender_id, message, file_url, file_name, created_at, read_at, is_filtered, filter_reason) FROM stdin;
1	1	2	💰 Order created. Buyer: testuser_qk-CL2, Seller: jerryoccean66	\N	\N	2026-04-13 16:01:37.346419	\N	f	\N
2	1	2	Hi! I will send the payment now via MonCash.	\N	\N	2026-04-13 16:01:37.346419	\N	f	\N
3	1	4	Ok, please send to 509-3456-7890. Let me know when done.	\N	\N	2026-04-13 16:01:37.346419	\N	f	\N
4	1	2	Payment sent! Transaction ID: MC-998877665. Please confirm.	\N	\N	2026-04-13 16:01:37.346419	\N	f	\N
5	1	4	I do not see any payment in my MonCash.	\N	\N	2026-04-13 16:01:37.346419	\N	f	\N
6	1	2	I have the screenshot! The payment went through.	\N	\N	2026-04-13 16:01:37.346419	\N	f	\N
7	1	2	⚠️ Dispute opened: Buyer says payment was sent but seller claims never received it.	\N	\N	2026-04-13 16:01:37.346419	\N	f	\N
8	1	1	🔒 Admin Decision: Funds refunded to seller after dispute investigation. Trade closed.	\N	\N	2026-04-13 16:05:26.358579	\N	f	\N
9	4	1	Order created. Waiting for buyer to complete payment.	\N	\N	2026-04-17 04:23:47.538465	\N	f	\N
10	4	1	Hello, ready to pay via MonCash.	\N	\N	2026-04-17 04:23:47.647119	\N	f	\N
11	4	1	Send me your number on WhatsApp please	\N	\N	2026-04-17 04:23:47.713855	\N	t	forbidden_word:whatsapp
12	4	1	Check this site: https://scam.example.com/pay	\N	\N	2026-04-17 04:23:47.785908	\N	t	external_link
13	4	1	contact me on fb	\N	\N	2026-04-17 04:23:47.858792	\N	t	forbidden_word:fb
14	4	1	go to mysite.com	\N	\N	2026-04-17 04:23:47.942126	\N	t	external_link
\.


--
-- Data for Name: p2p_dispute_actions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.p2p_dispute_actions (id, order_id, admin_id, action, reason, target_user_id, created_at) FROM stdin;
1	1	1	flag_user:Reported Buyer	Admin review: flagging and restricting both parties while resolving dispute	2	2026-04-13 16:05:03.103654
2	1	1	seller_restricted	Admin review: flagging and restricting both parties while resolving dispute	4	2026-04-13 16:05:08.721319
3	1	1	freeze_user	Admin review: flagging and restricting both parties while resolving dispute	2	2026-04-13 16:05:14.586097
4	1	1	refund_seller	Admin review: flagging and restricting both parties while resolving dispute	\N	2026-04-13 16:05:26.369328
5	3	1	Flag	seed dispute investigation	1	2026-04-13 16:33:15.661
\.


--
-- Data for Name: p2p_orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.p2p_orders (id, order_id, ad_id, buyer_id, seller_id, amount_usdt, amount_local, rate, currency, payment_method, status, cancelled_by, cancellation_reason, dispute_reason, seller_confirmed_receipt, paid_at, released_at, cancelled_at, created_at, expires_at, updated_at) FROM stdin;
1	ORD-TEST-001	2	2	4	50.00	7100.00	142.0000	HTG	MonCash	cancelled	admin	Admin review: flagging and restricting both parties while resolving dispute	Buyer says payment was sent but seller claims never received it.	f	\N	\N	2026-04-13 16:05:26.347363	2026-04-13 16:01:20.210123	\N	2026-04-13 16:01:20.210123
2	ORD-TEST-316938	2	1	4	100.00	14200.00	142.0000	HTG	MonCash	paid	\N	\N	Test dispute investigation - potential buyer fraud	f	\N	\N	\N	2026-04-13 16:32:44.242	\N	2026-04-13 16:32:44.244044
3	ORD-TEST-175270434	2	1	2	100.00	14200.00	142.0000	HTG	MonCash	disputed	\N	\N	Test: buyer claims payment was not received	f	\N	\N	\N	2026-04-13 16:32:53.48	\N	2026-04-13 16:32:53.480452
4	P2P-YFMLH0V2	2	1	4	10.00	1420.00	142.0000	HTG	MonCash	pending	\N	\N	\N	f	\N	\N	\N	2026-04-17 04:23:47.500186	2026-04-17 05:23:47.499	2026-04-17 04:23:47.500186
\.


--
-- Data for Name: p2p_transfers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.p2p_transfers (id, sender_profile_id, receiver_profile_id, amount, note, created_at, transaction_id, receipt_id) FROM stdin;
1	1	4	900.00	For you	2026-02-15 18:25:37.768703	IZ0000000001	\N
2	1	4	25.00	Gift	2026-02-15 18:26:27.183806	IZ0000000002	\N
\.


--
-- Data for Name: payout_requests; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payout_requests (id, user_id, merchant_id, amount, method, details, status, admin_note, processed_at, processed_by, created_at) FROM stdin;
\.


--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.profiles (id, full_name, email, role, kyc_status, balance, created_at, password_hash, email_verified, two_factor_secret, two_factor_enabled, phone, first_name, last_name, date_of_birth, country, city, is_banned, reference_id, is_deleted, deleted_at, pin_hash, strowallet_customer_id, can_edit_profile, frozen_until, withdrawal_pin_hash, last_ip, registration_ip, last_login_at, trc20_deposit_address, bep20_deposit_address, affiliate_enabled, referral_code, referral_balance, referred_by_id, p2p_welcome_message, p2p_seller_restricted, p2p_flagged_as, p2p_merchant_name, fcm_token, fcm_token_updated_at, otp_blocked, last_activity, newsletter_subscribed, newsletter_subscribed_at, pending_email, pending_phone) FROM stdin;
18	hhju	rttfuy@gmail.com	user	not_submitted	0.00	2026-02-16 19:28:55.933286	$2b$12$ou4ZdOlGt357U7rI2HPZP.3QHjTwLNNQjyUr6NH/K2vA0Z/WgJ0rC	f	\N	f	50949397949	\N	\N	\N	\N	\N	f	9287423575	f	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	f	\N	0.00	\N	\N	f	\N	\N	\N	\N	f	\N	f	\N	\N	\N
19	Johnson 	wigh7@gmail.com	user	not_submitted	0.00	2026-02-16 19:33:08.652123	$2b$12$PA6M3ADYBMAjh7ciX05ZYeQh/hpDbcMEO867NXYAeVdLAs6H4ep/6	f	\N	f	50949397949	\N	\N	\N	\N	\N	f	5320721087	f	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	f	\N	0.00	\N	\N	f	\N	\N	\N	\N	f	\N	f	\N	\N	\N
16	lovton jere	enerst@gmail.com	user	not_submitted	0.00	2026-02-16 18:46:49.182901	$2b$12$Upcv/D9ss.h2sU9nQM8AV.py8c8mK2Esp7m3LRrmSyOMF2ArKl/7e	t	\N	f	+50956202532	\N	\N	\N	\N	\N	f	4853203207	f	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	f	\N	0.00	\N	\N	f	\N	\N	\N	\N	f	\N	f	\N	\N	\N
20	Test account 	testacc@gman.com	user	not_submitted	0.00	2026-03-14 04:21:07.707949	$2b$12$4i1GxWEwy7pOrawoTIsUw.pRfkNjjit1n8Tl6yEMc3aQiWteWiSLS	f	\N	f	+509333768765	\N	\N	\N	\N	\N	f	4763578726	f	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	f	\N	0.00	\N	\N	f	\N	\N	\N	\N	f	\N	f	\N	\N	\N
29	QA Trade Tester	qa-trade-n8y1Y3X1@izitest.com	admin	not_submitted	0.00	2026-06-22 04:47:23.752733	$2b$12$NME6wEK1d/h27ntYONjjde.5gsJ7v/UsPGSZ5yyyoclMXvQ7AhEU2	t	\N	f	+15097880775443	\N	\N	\N	\N	\N	f	2151893364	f	\N	\N	\N	f	\N	\N	35.230.31.22	35.230.31.22	2026-06-22 04:47:36.88	\N	\N	f	\N	0.00	\N	\N	f	\N	\N	\N	\N	f	2026-06-22 04:47:36.97649	f	\N	\N	\N
14	ChatTest User	chattest_24yriK@test.com	user	not_submitted	0.00	2026-02-11 17:28:34.205746	$2b$12$s0cDdDQ/hIQ9TWcRAu8SbOwE83tsbb5WBmOPLFLBdxZq7btttwgme	t	\N	f	\N	\N	\N	\N	\N	\N	f	4433501691	f	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	f	\N	0.00	\N	\N	f	\N	\N	\N	\N	f	\N	f	\N	\N	\N
13	joavnie	jojo@gmail.com	user	not_submitted	0.00	2026-02-11 16:41:08.777146	$2b$12$wxzhqUeE0ZG73D7y8LPTP.nFtaEW1TCZR75BU08NyHmGndJkzOfTC	t	\N	f	\N	\N	\N	\N	\N	\N	t	4765469700	f	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	f	\N	0.00	\N	\N	f	\N	\N	\N	\N	f	\N	f	\N	\N	\N
15	PIERRE WILGENTZ	optpo@gmail.com	user	not_submitted	0.00	2026-02-11 20:28:07.092915	$2b$12$sO5LiG24aQpnSAhgKiw4c.8.Ai2O04Wbo0HTm3EYqt/MAzqChkXpG	t	\N	f	+50947930891	\N	\N	\N	\N	\N	f	7075816634	f	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	f	\N	0.00	\N	\N	f	\N	\N	\N	\N	f	\N	f	\N	\N	\N
3	Test User 5-ZU	testuserOALY_g@example.com	admin	not_submitted	0.00	2026-02-10 05:55:41.921879	$2b$12$HhQ7xdqNjqMkyouHv6ZaBONFRRM.QTofb/0D4UsG10b6bXb/n0VDu	t	\N	f	\N	\N	\N	\N	\N	\N	f	1988538412	f	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	f	\N	0.00	\N	\N	f	\N	\N	\N	\N	f	\N	f	\N	\N	\N
5	KYC Test User	kyctestJ3UwOy@example.com	user	verified	0.00	2026-02-10 13:27:07.936918	$2b$12$HGJMIKTnp/fxuMGMD8T5Vugu46exL4s3gsaUI/9.wfv0ztYlgX/SW	t	\N	f	\N	\N	\N	\N	\N	\N	f	2275901528	f	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	f	\N	0.00	\N	\N	f	\N	\N	\N	\N	f	\N	f	\N	\N	\N
6	Lang Test	langtestDk0rWh@example.com	user	not_submitted	0.00	2026-02-10 13:43:19.749007	$2b$12$bOLxjRKKGOVm1/5qPYItYeR4zJl7GeojU5cuF/PQ73X5lqd7HxuWC	t	\N	f	\N	\N	\N	\N	\N	\N	f	6734468373	f	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	f	\N	0.00	\N	\N	f	\N	\N	\N	\N	f	\N	f	\N	\N	\N
7	Withdraw Test	wdtestsslELG@example.com	user	verified	0.00	2026-02-10 13:58:48.638327	$2b$12$ckPvvkNATWSdJ/d1KIU/EOO6CQYpTGQ.ZHqDcAI5vUDz0J.G8L9yG	t	\N	f	\N	\N	\N	\N	\N	\N	f	4892807562	f	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	f	\N	0.00	\N	\N	f	\N	\N	\N	\N	f	\N	f	\N	\N	\N
8	Admin	admin@easychange.com	admin	verified	0.00	2026-02-10 14:22:00.629374	$2b$10$i1ZUs6kJDeRHRK3BHvYoOexHf0axVezlRNes6X0mJ3qLhFiA0FVaG	t	\N	f	\N	\N	\N	\N	\N	\N	f	8732053812	f	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	f	\N	0.00	\N	\N	f	\N	\N	\N	\N	f	\N	f	\N	\N	\N
9	Test Designer dFjCTO	testdesign_At29XX@example.com	user	not_submitted	0.00	2026-02-11 07:26:26.337218	$2b$12$qOnbRVRenB3Fg3Z6jzMx0OB.1QAWJtEAQX76CbAW/DwrVVkpmzz5a	t	\N	f	\N	\N	\N	\N	\N	\N	f	4834144714	f	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	f	\N	0.00	\N	\N	f	\N	\N	\N	\N	f	\N	f	\N	\N	\N
17	jibile jrer	ojhhyg2@gmail.com	user	not_submitted	20.00	2026-02-16 18:55:53.946333	$2b$12$aKu0v0fWIgRM0oOYKpE21OFn2mOPEAA9uMmpSULdbm89V9WulrJNS	f	\N	f	+50956202532	\N	\N	\N	\N	\N	f	1687873821	f	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	f	\N	0.00	\N	\N	f	\N	\N	\N	\N	f	\N	f	\N	\N	\N
4	Pierre Wilgentz	jerryoccean66@gmail.com	user	verified	1096.00	2026-02-10 06:00:37.859388	$2b$12$lFmHhtmrcu6ClZyJvCX1MOM1VERG0ki1aEhbJyNkQ86f.NQfhjPPm	t	\N	f	\N	\N	\N	\N	\N	\N	t	4592172430	f	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	f	IZI4141EF8	0.00	\N	\N	t	\N	\N	\N	\N	f	\N	f	\N	\N	\N
22	Test Victim User	testvictim@izichanj.test	user	verified	0.00	2026-03-26 22:45:08.297231	$2b$10$9DFfIg2w6FpVm1cALX.Rwu04OWx6UJUvF/tOHVljXgCUohvYfDoQi	t	\N	f	\N	\N	\N	\N	\N	\N	f	TEST-FRAUD-USR-001	f	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	f	\N	0.00	\N	\N	f	\N	\N	\N	\N	f	\N	f	\N	\N	\N
26	PayPal Live Test	pp_live_8c3754b0@izichanj.test	user	verified	0.00	2026-05-13 17:41:48.016459	$2b$12$n2lTmI2qHsGbxfEGAwB8p.u/8KM9wgGIoagX6/iaQuNErhAVxjlCO	t	\N	f	+509324448156	\N	\N	\N	\N	\N	f	PPL05c767	f	\N	\N	\N	f	\N	\N	34.182.20.110	\N	2026-05-13 17:42:00.723	\N	\N	f	\N	0.00	\N	\N	f	\N	\N	\N	\N	f	2026-05-13 17:47:02.541797	f	\N	\N	\N
28	QA Trade Tester	qa-trade-8KEIp56A@izitest.com	admin	not_submitted	0.00	2026-06-22 04:46:08.55949	$2b$12$4eHwF7yawGMprTA6lUssSuEAZjZySQo/KfHO.aevV9zLSSlxYsnQK	t	\N	f	+15098461141896	\N	\N	\N	\N	\N	f	6813410518	f	\N	\N	\N	f	\N	\N	35.230.31.22	35.230.31.22	2026-06-22 04:46:20.686	\N	\N	f	\N	0.00	\N	\N	f	\N	\N	\N	\N	f	2026-06-22 04:46:20.880918	f	\N	\N	\N
21	Test Fraud Admin	testfraud@izichanj.test	admin	verified	93.91	2026-03-26 22:45:04.288546	$2b$10$xoivU/iHMWO57zFZ8I/NRug2omg4iD5exUHAEe1DjyEbmG6hhOxvC	t	\N	f	\N	\N	\N	\N	\N	\N	f	TEST-FRAUD-001	f	\N	\N	\N	f	\N	\N	127.0.0.1	\N	2026-04-20 19:04:14.448	\N	\N	f	\N	0.00	\N	\N	f	\N	\N	\N	\N	f	\N	f	\N	\N	\N
25	PayPal Live Test	pp_live_1c50edee@izichanj.test	user	verified	0.00	2026-05-13 17:38:00.267103	$2b$12$n2lTmI2qHsGbxfEGAwB8p.u/8KM9wgGIoagX6/iaQuNErhAVxjlCO	t	\N	f	+509376063134	\N	\N	\N	\N	\N	f	PPL9669f6	f	\N	\N	\N	f	\N	\N	34.182.20.110	\N	2026-05-13 17:38:12.48	\N	\N	f	\N	0.00	\N	\N	f	\N	\N	\N	\N	f	2026-05-13 17:40:13.228047	f	\N	\N	\N
10	Limit Tester iQJlWF	limittest_nYRsSN@example.com	user	verified	0.00	2026-02-11 07:36:38.892688	$2b$12$vX8zginTv9rhgE2ZxSSrXuzjbp4gwK89yQ3gkInO.JIwV0pSupDQe	t	\N	f	\N	\N	\N	\N	\N	\N	f	2064417549	f	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	f	\N	0.00	\N	\N	f	\N	\N	\N	\N	f	\N	f	\N	\N	\N
11	Philips volmas	wiggyxpress@gmail.com	user	not_submitted	0.00	2026-02-11 08:46:37.622195	$2b$12$z8l4N/468MBiHvzcyObNpuG9.h6lLxR9CRAfuYUe2b1o2rtVDdkyy	f	\N	f	\N	\N	\N	\N	\N	\N	f	2470331709	f	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	f	\N	0.00	\N	\N	f	\N	\N	\N	\N	f	\N	f	\N	\N	\N
12	Philips volmas	achtellah@gmail.com	user	not_submitted	0.00	2026-02-11 08:47:30.598987	$2b$12$HF14cOifLL.1lUClpIU0/ucBprMzdgrbLXg5btM4yo31sPoPxyQBe	f	\N	f	\N	\N	\N	\N	\N	\N	f	1138669359	f	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	f	\N	0.00	\N	\N	f	\N	\N	\N	\N	f	\N	f	\N	\N	\N
2	Test User WqB8J8	testuser_qk-CL2@example.com	user	not_submitted	0.00	2026-02-10 05:43:10.56055	$2b$12$Z9TNZANtO/j.epB1aD1pZ.VCtpl5v0q6m8j6MNWJw7b1jU5Pr7OSa	f	\N	f	\N	\N	\N	\N	\N	\N	t	1995290783	f	\N	\N	\N	f	2026-04-20 16:05:14.583	\N	\N	\N	\N	\N	\N	f	\N	0.00	\N	\N	f	Reported Buyer	\N	\N	\N	f	\N	f	\N	\N	\N
23	QA Balance	qa_balance_1778576760936@test.com	user	not_submitted	25.50	2026-05-12 09:06:06.533695	$2b$10$6RjnU.HmjXfJ22PWNldNh.k93PSMqmamygLFcNHR/eav7c5cnNtFW	t	\N	f	+15555550788	\N	\N	\N	\N	\N	f	\N	f	\N	\N	\N	f	\N	\N	35.252.128.66	\N	2026-05-12 09:06:56.701	\N	\N	f	\N	0.00	\N	\N	f	\N	\N	\N	\N	f	2026-05-12 09:06:56.792362	f	\N	\N	\N
27	QA Trade Tester	qa-trade-hsS2U4Qo@izitest.com	admin	not_submitted	0.00	2026-06-22 04:43:44.398607	$2b$12$2yUqCnGF1r4X6msKoI/OhOAUet.HAWaWjiFwyoJQwkUDU58WSbiZG	t	\N	f	+15097606467515	\N	\N	\N	\N	\N	f	1315376555	f	\N	\N	\N	f	\N	\N	35.230.31.22	35.230.31.22	2026-06-22 04:43:56.003	\N	\N	f	\N	0.00	\N	\N	f	\N	\N	\N	\N	f	2026-06-22 04:43:56.162997	f	\N	\N	\N
1	Wilgentz PIERRE	wigens7@gmail.com	admin	verified	850.33	2026-02-10 05:15:13.870205	$2b$10$emLL18YQN3D9PBzhoqAPOuDSkA5NFk38k9hS3t4tUATyGXRm3RS.W	t	\N	f	+50949397949	\N	\N	\N	\N	\N	f	9905088165	f	\N	\N	\N	t	\N	\N	200.113.230.15	\N	2026-07-24 20:40:43.631	\N	\N	f	\N	0.00	\N	Welcome! Please send payment and notify me.	f	\N	MoneyFast HT	\N	2026-04-18 14:03:33.71633	f	2026-07-24 20:41:55.39166	f	\N	\N	\N
\.


--
-- Data for Name: referral_earnings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.referral_earnings (id, referrer_id, referee_id, type, amount, description, created_at) FROM stdin;
\.


--
-- Data for Name: referral_payout_requests; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.referral_payout_requests (id, profile_id, amount, status, admin_note, created_at, reviewed_at) FROM stdin;
\.


--
-- Data for Name: security_events; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.security_events (id, profile_id, event_type, ip_address, device_info, details, created_at, status) FROM stdin;
1	1	failed_login	34.53.51.201	Linux PC · Unknown · Chrome 140	Failed password attempt for wigens7@gmail.com	2026-04-20 19:23:45.980505	warning
2	1	failed_login	34.53.51.201	Linux PC · Unknown · Chrome 140	Failed password attempt for wigens7@gmail.com	2026-04-20 19:23:54.710907	warning
3	1	failed_login	34.53.51.201	Linux PC · Unknown · Chrome 140	Failed password attempt for wigens7@gmail.com	2026-04-20 19:23:57.121485	warning
4	1	failed_login	34.53.51.201	Linux PC · Unknown · Chrome 140	Failed password attempt for wigens7@gmail.com	2026-04-20 19:23:59.595291	warning
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sessions (sid, sess, expire) FROM stdin;
Ky9eqmrcbkLKGPPw1-ZP5pZ8-xM1HCvf	{"cookie": {"path": "/", "secure": false, "expires": "2026-07-25T04:40:43.632Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 28800000}, "profileId": 1}	2026-07-25 04:42:55
\.


--
-- Data for Name: support_conversations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.support_conversations (id, profile_id, status, created_at, updated_at, rating, closed_by) FROM stdin;
1	13	closed	2026-02-11 17:12:10.481038	2026-02-11 17:24:39.237	\N	\N
2	14	closed	2026-02-11 17:28:56.416572	2026-02-11 17:29:33.175	4	user
3	14	closed	2026-02-11 17:29:43.885989	2026-02-11 17:34:52.568	\N	\N
4	13	closed	2026-02-11 17:31:15.064782	2026-02-11 17:38:52.57	\N	\N
5	13	closed	2026-02-11 17:41:04.140559	2026-02-11 17:46:51.537	\N	\N
6	13	closed	2026-02-11 17:47:55.95892	2026-02-11 17:53:50.355	5	user
7	13	closed	2026-02-11 17:53:50.584926	2026-02-11 17:59:23.325	\N	\N
\.


--
-- Data for Name: support_messages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.support_messages (id, conversation_id, sender, sender_profile_id, message, created_at, file_url, file_name) FROM stdin;
1	1	user	13	How does KYC verification work?	2026-02-11 17:12:15.756742	\N	\N
2	1	bot	\N	KYC verification requires:\n1. Go to Profile & KYC page\n2. Upload your national ID card (front and back)\n3. Upload a selfie holding your ID\n4. Submit and wait for admin review\nKYC is required before making deposits or withdrawals.	2026-02-11 17:12:15.764414	\N	\N
3	1	bot	\N	You've been connected to our support queue. Please be patient, an agent will talk to you soon. Feel free to describe your issue while you wait.	2026-02-11 17:12:37.191648	\N	\N
4	1	user	13	hello	2026-02-11 17:13:00.630918	\N	\N
5	1	admin	8	Hello welcome to EasyChange,how can help you today?	2026-02-11 17:14:20.742625	\N	\N
6	1	user	13	good test admin	2026-02-11 17:15:01.899733	\N	\N
7	1	bot	\N	This conversation has been automatically closed due to inactivity. Thank you for contacting us! Feel free to chat back anytime you need help.	2026-02-11 17:24:39.23065	\N	\N
8	2	user	14	How do I deposit USDT?	2026-02-11 17:29:07.356579	\N	\N
9	2	bot	\N	To deposit USDT:\n1. Go to the Deposit page\n2. Copy one of our wallet addresses (TRC20 or BEP20)\n3. Send USDT from your crypto wallet\n4. Enter the amount and transaction hash\n5. Submit and wait for admin approval (usually within minutes)	2026-02-11 17:29:07.36395	\N	\N
10	2	bot	\N	Thank you for contacting us! Your chat has been ended. You can start a new conversation anytime. Have a great day!	2026-02-11 17:29:33.169195	\N	\N
11	4	user	13	How do I deposit USDT?	2026-02-11 17:31:21.933303	\N	\N
12	4	bot	\N	To deposit USDT:\n1. Go to the Deposit page\n2. Copy one of our wallet addresses (TRC20 or BEP20)\n3. Send USDT from your crypto wallet\n4. Enter the amount and transaction hash\n5. Submit and wait for admin approval (usually within minutes)	2026-02-11 17:31:22.014555	\N	\N
13	4	bot	\N	You've been connected to our support queue. Please be patient, an agent will talk to you soon. Feel free to describe your issue while you wait.	2026-02-11 17:31:36.063846	\N	\N
14	4	user	13	baz sakap fet m bezwen aide ou wi	2026-02-11 17:32:04.588212	\N	\N
15	4	admin	8	Ann pale bro	2026-02-11 17:32:51.969492	\N	\N
16	4	user	13	ok	2026-02-11 17:33:22.366935	\N	\N
17	3	bot	\N	This conversation has been automatically closed due to inactivity. Thank you for contacting us! Feel free to chat back anytime you need help.	2026-02-11 17:34:52.562027	\N	\N
18	4	bot	\N	This conversation has been automatically closed due to inactivity. Thank you for contacting us! Feel free to chat back anytime you need help.	2026-02-11 17:38:52.563739	\N	\N
19	5	bot	\N	This conversation has been automatically closed due to inactivity. Thank you for contacting us! Feel free to chat back anytime you need help.	2026-02-11 17:46:51.530075	\N	\N
20	6	bot	\N	You've been connected to our support queue. Please be patient, an agent will talk to you soon. Feel free to describe your issue while you wait.	2026-02-11 17:47:55.97983	\N	\N
21	6	user	13	hello i need help	2026-02-11 17:48:40.684387	\N	\N
22	6	bot	\N	I understand you'd like to speak with a support agent. Please be patient, an agent will be with you shortly. In the meantime, feel free to describe your issue and we'll get back to you as soon as possible.	2026-02-11 17:48:40.694718	\N	\N
23	6	user	13	hello	2026-02-11 17:49:00.516331	\N	\N
24	6	user	13	agent	2026-02-11 17:50:06.649649	\N	\N
25	6	bot	\N	I understand you'd like to speak with a support agent. Please be patient, an agent will be with you shortly. In the meantime, feel free to describe your issue and we'll get back to you as soon as possible.	2026-02-11 17:50:06.724916	\N	\N
26	6	admin	8	Hello ,how many help do you need	2026-02-11 17:52:20.014167	\N	\N
27	6	admin	8	Send you screenshots	2026-02-11 17:52:34.496417	\N	\N
28	6	user	13	Sent a file: download.jpg	2026-02-11 17:53:06.715908	/objects/uploads/80595e11-e079-41ca-8738-cca4d15b7872	download.jpg
29	6	admin	8	Thank you	2026-02-11 17:53:30.659605	\N	\N
30	6	bot	\N	Thank you for contacting us! Your chat has been ended. You can start a new conversation anytime. Have a great day!	2026-02-11 17:53:50.348935	\N	\N
31	7	bot	\N	This conversation has been automatically closed due to inactivity. Thank you for contacting us! Feel free to chat back anytime you need help.	2026-02-11 17:59:23.278464	\N	\N
\.


--
-- Data for Name: support_quick_replies; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.support_quick_replies (id, shortcut, label, message, sort_order, created_at) FROM stdin;
\.


--
-- Data for Name: top_up_transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.top_up_transactions (id, profile_id, operator_id, operator_name, phone, amount_usd, transaction_id, status, created_at) FROM stdin;
\.


--
-- Data for Name: user_reports; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_reports (id, reporter_profile_id, reported_identifier, reported_profile_id, reason, description, proof_image_url, status, admin_note, created_at, reviewed_at) FROM stdin;
1	1	test@example.com	\N	fraud	This user tried to scam me by sending false payment proof and then disappearing after I sent the funds.	\N	reviewed	Investigating this report	2026-04-08 03:58:29.445748	2026-04-08 03:59:01.357
2	1	wigens7@gmail.com	1	fraud	Test report for admin freeze action testing. This is a test with more than 20 characters.	\N	pending	\N	2026-04-08 04:13:05.726229	\N
3	1	wigens7@gmail.com	1	fraud	Testing admin freeze action from a real user report in our QA suite. This has enough characters.	\N	pending	\N	2026-04-08 04:15:22.833806	\N
\.


--
-- Data for Name: virtual_cards; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.virtual_cards (id, profile_id, card_id, card_type, name_on_card, last4, brand, status, card_balance, card_currency, card_detail, created_at) FROM stdin;
1	17	pending_test_12345	visa	Test User	\N	Visa	cancelled	20.00	USD	\N	2026-03-23 21:38:32.261142
2	1	test_active_card_001	visa	Wilgentz PIERRE	4242	Visa	active	20.00	USD	\N	2026-03-28 04:26:26.862643
\.


--
-- Data for Name: webauthn_credentials; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.webauthn_credentials (id, profile_id, credential_id, public_key, counter, device_name, created_at) FROM stdin;
\.


--
-- Data for Name: webhook_dedup; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.webhook_dedup (event_key, source, created_at) FROM stdin;
\.


--
-- Data for Name: withdrawals; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.withdrawals (id, profile_id, amount, currency, phone_number, status, created_at, withdraw_method, qr_code_url, receipt_id, receipt_url, trc_address, fee, ip_address) FROM stdin;
1	4	49397949.00	MonCash	+50949397949	approved	2026-02-10 13:12:43.385237	phone	\N	\N	\N	\N	2.50	\N
\.


--
-- Name: app_downloads_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.app_downloads_id_seq', 2, true);


--
-- Name: balance_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.balance_logs_id_seq', 3, true);


--
-- Name: blacklisted_users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.blacklisted_users_id_seq', 1, false);


--
-- Name: canalplus_subscriptions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.canalplus_subscriptions_id_seq', 4, true);


--
-- Name: card_transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.card_transactions_id_seq', 1, true);


--
-- Name: deposits_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.deposits_id_seq', 11, true);


--
-- Name: fraud_rejections_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.fraud_rejections_id_seq', 1, true);


--
-- Name: kyc_archives_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.kyc_archives_id_seq', 1, false);


--
-- Name: kyc_documents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.kyc_documents_id_seq', 2, true);


--
-- Name: login_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.login_logs_id_seq', 80, true);


--
-- Name: merchant_transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.merchant_transactions_id_seq', 7, true);


--
-- Name: merchants_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.merchants_id_seq', 1, true);


--
-- Name: nfc_card_transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.nfc_card_transactions_id_seq', 1, false);


--
-- Name: nfc_cards_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.nfc_cards_id_seq', 1, false);


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.notifications_id_seq', 26, true);


--
-- Name: otps_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.otps_id_seq', 37, true);


--
-- Name: p2p_ads_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.p2p_ads_id_seq', 3, true);


--
-- Name: p2p_bans_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.p2p_bans_id_seq', 1, false);


--
-- Name: p2p_cancellations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.p2p_cancellations_id_seq', 1, false);


--
-- Name: p2p_chat_messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.p2p_chat_messages_id_seq', 14, true);


--
-- Name: p2p_dispute_actions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.p2p_dispute_actions_id_seq', 5, true);


--
-- Name: p2p_orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.p2p_orders_id_seq', 4, true);


--
-- Name: p2p_transfers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.p2p_transfers_id_seq', 2, true);


--
-- Name: payout_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.payout_requests_id_seq', 1, false);


--
-- Name: profiles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.profiles_id_seq', 29, true);


--
-- Name: referral_earnings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.referral_earnings_id_seq', 1, false);


--
-- Name: referral_payout_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.referral_payout_requests_id_seq', 1, false);


--
-- Name: security_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.security_events_id_seq', 4, true);


--
-- Name: support_conversations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.support_conversations_id_seq', 7, true);


--
-- Name: support_messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.support_messages_id_seq', 31, true);


--
-- Name: support_quick_replies_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.support_quick_replies_id_seq', 1, false);


--
-- Name: top_up_transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.top_up_transactions_id_seq', 1, false);


--
-- Name: user_reports_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_reports_id_seq', 3, true);


--
-- Name: virtual_cards_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.virtual_cards_id_seq', 2, true);


--
-- Name: webauthn_credentials_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.webauthn_credentials_id_seq', 1, false);


--
-- Name: withdrawals_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.withdrawals_id_seq', 1, true);


--
-- Name: app_downloads app_downloads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_downloads
    ADD CONSTRAINT app_downloads_pkey PRIMARY KEY (id);


--
-- Name: app_settings app_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_pkey PRIMARY KEY (key);


--
-- Name: balance_logs balance_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.balance_logs
    ADD CONSTRAINT balance_logs_pkey PRIMARY KEY (id);


--
-- Name: blacklisted_users blacklisted_users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blacklisted_users
    ADD CONSTRAINT blacklisted_users_pkey PRIMARY KEY (id);


--
-- Name: canalplus_subscriptions canalplus_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.canalplus_subscriptions
    ADD CONSTRAINT canalplus_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: card_transactions card_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.card_transactions
    ADD CONSTRAINT card_transactions_pkey PRIMARY KEY (id);


--
-- Name: deposits deposits_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deposits
    ADD CONSTRAINT deposits_pkey PRIMARY KEY (id);


--
-- Name: deposits deposits_receipt_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deposits
    ADD CONSTRAINT deposits_receipt_id_key UNIQUE (receipt_id);


--
-- Name: fraud_rejections fraud_rejections_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fraud_rejections
    ADD CONSTRAINT fraud_rejections_pkey PRIMARY KEY (id);


--
-- Name: kyc_archives kyc_archives_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kyc_archives
    ADD CONSTRAINT kyc_archives_pkey PRIMARY KEY (id);


--
-- Name: kyc_documents kyc_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kyc_documents
    ADD CONSTRAINT kyc_documents_pkey PRIMARY KEY (id);


--
-- Name: login_logs login_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.login_logs
    ADD CONSTRAINT login_logs_pkey PRIMARY KEY (id);


--
-- Name: merchant_transactions merchant_transactions_payment_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.merchant_transactions
    ADD CONSTRAINT merchant_transactions_payment_id_key UNIQUE (payment_id);


--
-- Name: merchant_transactions merchant_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.merchant_transactions
    ADD CONSTRAINT merchant_transactions_pkey PRIMARY KEY (id);


--
-- Name: merchants merchants_api_public_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.merchants
    ADD CONSTRAINT merchants_api_public_key_key UNIQUE (api_public_key);


--
-- Name: merchants merchants_api_secret_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.merchants
    ADD CONSTRAINT merchants_api_secret_key_key UNIQUE (api_secret_key);


--
-- Name: merchants merchants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.merchants
    ADD CONSTRAINT merchants_pkey PRIMARY KEY (id);


--
-- Name: merchants merchants_profile_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.merchants
    ADD CONSTRAINT merchants_profile_id_key UNIQUE (profile_id);


--
-- Name: nfc_card_transactions nfc_card_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nfc_card_transactions
    ADD CONSTRAINT nfc_card_transactions_pkey PRIMARY KEY (id);


--
-- Name: nfc_cards nfc_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nfc_cards
    ADD CONSTRAINT nfc_cards_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: otps otps_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.otps
    ADD CONSTRAINT otps_pkey PRIMARY KEY (id);


--
-- Name: p2p_ads p2p_ads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.p2p_ads
    ADD CONSTRAINT p2p_ads_pkey PRIMARY KEY (id);


--
-- Name: p2p_bans p2p_bans_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.p2p_bans
    ADD CONSTRAINT p2p_bans_pkey PRIMARY KEY (id);


--
-- Name: p2p_cancellations p2p_cancellations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.p2p_cancellations
    ADD CONSTRAINT p2p_cancellations_pkey PRIMARY KEY (id);


--
-- Name: p2p_chat_messages p2p_chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.p2p_chat_messages
    ADD CONSTRAINT p2p_chat_messages_pkey PRIMARY KEY (id);


--
-- Name: p2p_dispute_actions p2p_dispute_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.p2p_dispute_actions
    ADD CONSTRAINT p2p_dispute_actions_pkey PRIMARY KEY (id);


--
-- Name: p2p_orders p2p_orders_order_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.p2p_orders
    ADD CONSTRAINT p2p_orders_order_id_key UNIQUE (order_id);


--
-- Name: p2p_orders p2p_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.p2p_orders
    ADD CONSTRAINT p2p_orders_pkey PRIMARY KEY (id);


--
-- Name: p2p_transfers p2p_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.p2p_transfers
    ADD CONSTRAINT p2p_transfers_pkey PRIMARY KEY (id);


--
-- Name: p2p_transfers p2p_transfers_transaction_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.p2p_transfers
    ADD CONSTRAINT p2p_transfers_transaction_id_key UNIQUE (transaction_id);


--
-- Name: payout_requests payout_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payout_requests
    ADD CONSTRAINT payout_requests_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_email_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_email_unique UNIQUE (email);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_reference_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_reference_id_key UNIQUE (reference_id);


--
-- Name: profiles profiles_referral_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_referral_code_key UNIQUE (referral_code);


--
-- Name: referral_earnings referral_earnings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.referral_earnings
    ADD CONSTRAINT referral_earnings_pkey PRIMARY KEY (id);


--
-- Name: referral_payout_requests referral_payout_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.referral_payout_requests
    ADD CONSTRAINT referral_payout_requests_pkey PRIMARY KEY (id);


--
-- Name: security_events security_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.security_events
    ADD CONSTRAINT security_events_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (sid);


--
-- Name: support_conversations support_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_conversations
    ADD CONSTRAINT support_conversations_pkey PRIMARY KEY (id);


--
-- Name: support_messages support_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_messages
    ADD CONSTRAINT support_messages_pkey PRIMARY KEY (id);


--
-- Name: support_quick_replies support_quick_replies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_quick_replies
    ADD CONSTRAINT support_quick_replies_pkey PRIMARY KEY (id);


--
-- Name: support_quick_replies support_quick_replies_shortcut_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_quick_replies
    ADD CONSTRAINT support_quick_replies_shortcut_key UNIQUE (shortcut);


--
-- Name: top_up_transactions top_up_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.top_up_transactions
    ADD CONSTRAINT top_up_transactions_pkey PRIMARY KEY (id);


--
-- Name: user_reports user_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_reports
    ADD CONSTRAINT user_reports_pkey PRIMARY KEY (id);


--
-- Name: virtual_cards virtual_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.virtual_cards
    ADD CONSTRAINT virtual_cards_pkey PRIMARY KEY (id);


--
-- Name: webauthn_credentials webauthn_credentials_credential_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.webauthn_credentials
    ADD CONSTRAINT webauthn_credentials_credential_id_unique UNIQUE (credential_id);


--
-- Name: webauthn_credentials webauthn_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.webauthn_credentials
    ADD CONSTRAINT webauthn_credentials_pkey PRIMARY KEY (id);


--
-- Name: webhook_dedup webhook_dedup_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.webhook_dedup
    ADD CONSTRAINT webhook_dedup_pkey PRIMARY KEY (event_key);


--
-- Name: withdrawals withdrawals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.withdrawals
    ADD CONSTRAINT withdrawals_pkey PRIMARY KEY (id);


--
-- Name: withdrawals withdrawals_receipt_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.withdrawals
    ADD CONSTRAINT withdrawals_receipt_id_key UNIQUE (receipt_id);


--
-- Name: IDX_session_expire; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_session_expire" ON public.sessions USING btree (expire);


--
-- Name: deposits_paypal_order_id_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX deposits_paypal_order_id_unique ON public.deposits USING btree (paypal_order_id) WHERE (paypal_order_id IS NOT NULL);


--
-- Name: idx_merchant_txn_merchant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_merchant_txn_merchant ON public.merchant_transactions USING btree (merchant_id, created_at DESC);


--
-- Name: idx_merchant_txn_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_merchant_txn_status ON public.merchant_transactions USING btree (status);


--
-- Name: nfc_card_transactions_provider_tx_id_uniq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX nfc_card_transactions_provider_tx_id_uniq ON public.nfc_card_transactions USING btree (card_id, provider_tx_id) WHERE (provider_tx_id IS NOT NULL);


--
-- Name: p2p_transfers_receipt_id_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX p2p_transfers_receipt_id_unique ON public.p2p_transfers USING btree (receipt_id) WHERE (receipt_id IS NOT NULL);


--
-- Name: support_quick_replies_shortcut_lower_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX support_quick_replies_shortcut_lower_idx ON public.support_quick_replies USING btree (lower(shortcut));


--
-- Name: app_downloads app_downloads_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_downloads
    ADD CONSTRAINT app_downloads_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id);


--
-- Name: balance_logs balance_logs_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.balance_logs
    ADD CONSTRAINT balance_logs_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id);


--
-- Name: canalplus_subscriptions canalplus_subscriptions_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.canalplus_subscriptions
    ADD CONSTRAINT canalplus_subscriptions_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id);


--
-- Name: card_transactions card_transactions_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.card_transactions
    ADD CONSTRAINT card_transactions_card_id_fkey FOREIGN KEY (card_id) REFERENCES public.virtual_cards(id);


--
-- Name: card_transactions card_transactions_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.card_transactions
    ADD CONSTRAINT card_transactions_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id);


--
-- Name: deposits deposits_profile_id_profiles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deposits
    ADD CONSTRAINT deposits_profile_id_profiles_id_fk FOREIGN KEY (profile_id) REFERENCES public.profiles(id);


--
-- Name: fraud_rejections fraud_rejections_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fraud_rejections
    ADD CONSTRAINT fraud_rejections_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id);


--
-- Name: kyc_documents kyc_documents_profile_id_profiles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kyc_documents
    ADD CONSTRAINT kyc_documents_profile_id_profiles_id_fk FOREIGN KEY (profile_id) REFERENCES public.profiles(id);


--
-- Name: login_logs login_logs_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.login_logs
    ADD CONSTRAINT login_logs_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id);


--
-- Name: merchant_transactions merchant_transactions_merchant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.merchant_transactions
    ADD CONSTRAINT merchant_transactions_merchant_id_fkey FOREIGN KEY (merchant_id) REFERENCES public.merchants(id);


--
-- Name: merchant_transactions merchant_transactions_payer_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.merchant_transactions
    ADD CONSTRAINT merchant_transactions_payer_profile_id_fkey FOREIGN KEY (payer_profile_id) REFERENCES public.profiles(id);


--
-- Name: merchants merchants_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.merchants
    ADD CONSTRAINT merchants_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id);


--
-- Name: nfc_card_transactions nfc_card_transactions_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nfc_card_transactions
    ADD CONSTRAINT nfc_card_transactions_card_id_fkey FOREIGN KEY (card_id) REFERENCES public.nfc_cards(id);


--
-- Name: nfc_card_transactions nfc_card_transactions_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nfc_card_transactions
    ADD CONSTRAINT nfc_card_transactions_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id);


--
-- Name: nfc_cards nfc_cards_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nfc_cards
    ADD CONSTRAINT nfc_cards_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id);


--
-- Name: notifications notifications_profile_id_profiles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_profile_id_profiles_id_fk FOREIGN KEY (profile_id) REFERENCES public.profiles(id);


--
-- Name: otps otps_profile_id_profiles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.otps
    ADD CONSTRAINT otps_profile_id_profiles_id_fk FOREIGN KEY (profile_id) REFERENCES public.profiles(id);


--
-- Name: p2p_ads p2p_ads_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.p2p_ads
    ADD CONSTRAINT p2p_ads_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.profiles(id);


--
-- Name: p2p_bans p2p_bans_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.p2p_bans
    ADD CONSTRAINT p2p_bans_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id);


--
-- Name: p2p_cancellations p2p_cancellations_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.p2p_cancellations
    ADD CONSTRAINT p2p_cancellations_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.p2p_orders(id);


--
-- Name: p2p_cancellations p2p_cancellations_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.p2p_cancellations
    ADD CONSTRAINT p2p_cancellations_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id);


--
-- Name: p2p_chat_messages p2p_chat_messages_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.p2p_chat_messages
    ADD CONSTRAINT p2p_chat_messages_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.p2p_orders(id);


--
-- Name: p2p_chat_messages p2p_chat_messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.p2p_chat_messages
    ADD CONSTRAINT p2p_chat_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id);


--
-- Name: p2p_orders p2p_orders_ad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.p2p_orders
    ADD CONSTRAINT p2p_orders_ad_id_fkey FOREIGN KEY (ad_id) REFERENCES public.p2p_ads(id);


--
-- Name: p2p_orders p2p_orders_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.p2p_orders
    ADD CONSTRAINT p2p_orders_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.profiles(id);


--
-- Name: p2p_orders p2p_orders_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.p2p_orders
    ADD CONSTRAINT p2p_orders_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.profiles(id);


--
-- Name: p2p_transfers p2p_transfers_receiver_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.p2p_transfers
    ADD CONSTRAINT p2p_transfers_receiver_profile_id_fkey FOREIGN KEY (receiver_profile_id) REFERENCES public.profiles(id);


--
-- Name: p2p_transfers p2p_transfers_sender_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.p2p_transfers
    ADD CONSTRAINT p2p_transfers_sender_profile_id_fkey FOREIGN KEY (sender_profile_id) REFERENCES public.profiles(id);


--
-- Name: payout_requests payout_requests_merchant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payout_requests
    ADD CONSTRAINT payout_requests_merchant_id_fkey FOREIGN KEY (merchant_id) REFERENCES public.merchants(id);


--
-- Name: payout_requests payout_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payout_requests
    ADD CONSTRAINT payout_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);


--
-- Name: profiles profiles_referred_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_referred_by_id_fkey FOREIGN KEY (referred_by_id) REFERENCES public.profiles(id);


--
-- Name: referral_earnings referral_earnings_referee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.referral_earnings
    ADD CONSTRAINT referral_earnings_referee_id_fkey FOREIGN KEY (referee_id) REFERENCES public.profiles(id);


--
-- Name: referral_earnings referral_earnings_referrer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.referral_earnings
    ADD CONSTRAINT referral_earnings_referrer_id_fkey FOREIGN KEY (referrer_id) REFERENCES public.profiles(id);


--
-- Name: referral_payout_requests referral_payout_requests_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.referral_payout_requests
    ADD CONSTRAINT referral_payout_requests_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id);


--
-- Name: security_events security_events_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.security_events
    ADD CONSTRAINT security_events_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id);


--
-- Name: support_conversations support_conversations_profile_id_profiles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_conversations
    ADD CONSTRAINT support_conversations_profile_id_profiles_id_fk FOREIGN KEY (profile_id) REFERENCES public.profiles(id);


--
-- Name: support_messages support_messages_conversation_id_support_conversations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_messages
    ADD CONSTRAINT support_messages_conversation_id_support_conversations_id_fk FOREIGN KEY (conversation_id) REFERENCES public.support_conversations(id);


--
-- Name: support_messages support_messages_sender_profile_id_profiles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support_messages
    ADD CONSTRAINT support_messages_sender_profile_id_profiles_id_fk FOREIGN KEY (sender_profile_id) REFERENCES public.profiles(id);


--
-- Name: top_up_transactions top_up_transactions_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.top_up_transactions
    ADD CONSTRAINT top_up_transactions_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id);


--
-- Name: user_reports user_reports_reported_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_reports
    ADD CONSTRAINT user_reports_reported_profile_id_fkey FOREIGN KEY (reported_profile_id) REFERENCES public.profiles(id);


--
-- Name: user_reports user_reports_reporter_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_reports
    ADD CONSTRAINT user_reports_reporter_profile_id_fkey FOREIGN KEY (reporter_profile_id) REFERENCES public.profiles(id);


--
-- Name: virtual_cards virtual_cards_profile_id_profiles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.virtual_cards
    ADD CONSTRAINT virtual_cards_profile_id_profiles_id_fk FOREIGN KEY (profile_id) REFERENCES public.profiles(id);


--
-- Name: webauthn_credentials webauthn_credentials_profile_id_profiles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.webauthn_credentials
    ADD CONSTRAINT webauthn_credentials_profile_id_profiles_id_fk FOREIGN KEY (profile_id) REFERENCES public.profiles(id);


--
-- Name: withdrawals withdrawals_profile_id_profiles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.withdrawals
    ADD CONSTRAINT withdrawals_profile_id_profiles_id_fk FOREIGN KEY (profile_id) REFERENCES public.profiles(id);


--
-- PostgreSQL database dump complete
--

\unrestrict Wgo3aPSqZKY3G3kfxpWfzKY52JWzgMvlSHR4hStRxUxD3ieKkBNV5TLEkbsqtzJ

