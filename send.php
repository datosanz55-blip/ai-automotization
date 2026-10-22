<?php
/**
 * Обработчик заявок с сайта УралСМТ.
 * Отправляет письмо на адрес из $to через функцию mail() хостинга.
 * Отвечает JSON: {"ok": true} или {"ok": false, "error": "..."}.
 */
header('Content-Type: application/json; charset=utf-8');

$to = 'uralsmt74@yandex.ru';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'method']);
    exit;
}

// Скрытое поле-ловушка для ботов
if (!empty($_POST['website'])) {
    echo json_encode(['ok' => true]);
    exit;
}

function field($name, $max = 1000) {
    $v = isset($_POST[$name]) ? trim((string)$_POST[$name]) : '';
    $v = str_replace(["\r", "\0"], '', $v);
    return mb_substr($v, 0, $max, 'UTF-8');
}

$name    = field('name', 120);
$phone   = field('phone', 40);
$email   = field('email', 120);
$service = field('service', 160);
$message = field('message', 3000);
$page    = field('page', 300);

if ($name === '' || strlen(preg_replace('/\D/', '', $phone)) < 10) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'error' => 'validation']);
    exit;
}
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $email = '';
}

$body  = "Заявка с сайта uralsmt.ru\n\n";
$body .= "Услуга: " . ($service ?: '—') . "\n";
$body .= "Имя: {$name}\n";
$body .= "Телефон: {$phone}\n";
if ($email)   $body .= "E-mail: {$email}\n";
if ($message) $body .= "\nСообщение:\n{$message}\n";
$body .= "\nСтраница: {$page}\nВремя: " . date('d.m.Y H:i') . "\n";

$subject = '=?UTF-8?B?' . base64_encode('Заявка с сайта: ' . ($service ?: 'обратный звонок')) . '?=';
$host = preg_replace('/[^a-z0-9.\-]/i', '', $_SERVER['HTTP_HOST'] ?? 'localhost');
$headers = [
    'From: =?UTF-8?B?' . base64_encode('Сайт УралСМТ') . "?= <noreply@{$host}>",
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
];
if ($email) $headers[] = 'Reply-To: ' . $email;

$sent = @mail($to, $subject, $body, implode("\r\n", $headers));

if (!$sent) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'mail']);
    exit;
}
echo json_encode(['ok' => true]);
