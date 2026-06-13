# 📚 GUÍA DE DESPLIEGUE: ACME ERP en AWS

## 🏗️ Arquitectura (Según Diagrama)

```
AWS Cloud (VPC: 10.0.0.0/16)
├── Subnet Pública (10.0.1.0/24)
│   ├── Internet Gateway
│   └── EC2 t3.medium (Ubuntu 22.04)
│       ├── Docker + Docker Compose
│       ├── Frontend Express (3000)
│       └── Backend Django (8000)
│       └── Nginx Reverse Proxy (80/443)
│
├── Subnet Privada (10.0.2.0/24)
│   └── RDS PostgreSQL 16
│       ├── Multi-AZ deployment
│       └── Automated backups (24h)
│
├── Security Groups
│   ├── ALB: 80, 443 → todo internet
│   ├── EC2: 22 (SSH), 80, 443, 3000, 8000
│   └── RDS: 5432 ← Solo desde EC2
│
└── Servicios de Soporte
    ├── S3 bucket para backups y archivos estáticos
    ├── CloudWatch para logs y monitoreo
    ├── Route 53 para DNS (opcional)
    └── ACM para certificados SSL/TLS
```

---

## 📋 PRE-REQUISITOS

1. **Cuenta AWS activa** con permisos administrativos
2. **AWS CLI instalado** en tu máquina local
3. **Clave SSH generada** (para acceso EC2)
4. **Dominio** (opcional, para HTTPS)
5. **Git** instalado

---

## ⚙️ PASO 1: CREAR VPC Y SUBNETS

### Opción A: Usando AWS Console (Manual)

1. **VPC:**
   - Ir a: Services → VPC → Create VPC
   - Nombre: `acme-erp-vpc`
   - CIDR: `10.0.0.0/16`
   - IPv6 CIDR: No necesario
   - Click "Create"

2. **Internet Gateway:**
   - VPC → Internet Gateways → Create Internet Gateway
   - Nombre: `acme-igw`
   - Attach to VPC: `acme-erp-vpc`

3. **Subnets:**
   - **Pública:**
     - VPC: `acme-erp-vpc`
     - CIDR: `10.0.1.0/24`
     - AZ: `us-east-1a`
     - Nombre: `acme-public-subnet`
   
   - **Privada:**
     - VPC: `acme-erp-vpc`
     - CIDR: `10.0.2.0/24`
     - AZ: `us-east-1b`
     - Nombre: `acme-private-subnet`

4. **Route Tables:**
   - Crear RT pública y asociar a subnet pública
   - Agregar ruta: `0.0.0.0/0 → IGW`

### Opción B: Usando Terraform (Automatizado)

```bash
# En el workspace, crear archivo: terraform/vpc.tf
# (Incluido en terraform-deploy.md)
terraform init
terraform plan
terraform apply
```

---

## 🔐 PASO 2: CREAR SECURITY GROUPS

```bash
# 1. SG para ALB (Load Balancer)
aws ec2 create-security-group \
  --group-name acme-alb-sg \
  --description "Security group for ACME ERP ALB" \
  --vpc-id vpc-xxxxx

ALB_SG_ID=$(aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=acme-alb-sg" \
  --query 'SecurityGroups[0].GroupId' --output text)

# Inbound: HTTP, HTTPS desde anywhere
aws ec2 authorize-security-group-ingress \
  --group-id $ALB_SG_ID \
  --protocol tcp --port 80 --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
  --group-id $ALB_SG_ID \
  --protocol tcp --port 443 --cidr 0.0.0.0/0

# 2. SG para EC2
aws ec2 create-security-group \
  --group-name acme-ec2-sg \
  --description "Security group for ACME ERP EC2" \
  --vpc-id vpc-xxxxx

EC2_SG_ID=$(aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=acme-ec2-sg" \
  --query 'SecurityGroups[0].GroupId' --output text)

# Inbound: SSH
aws ec2 authorize-security-group-ingress \
  --group-id $EC2_SG_ID \
  --protocol tcp --port 22 --cidr 0.0.0.0/0 \
  --description "SSH access"

# Inbound: Desde ALB
aws ec2 authorize-security-group-ingress \
  --group-id $EC2_SG_ID \
  --protocol tcp --port 80 \
  --source-group $ALB_SG_ID

# Inbound: Aplicación (opcional para debug)
aws ec2 authorize-security-group-ingress \
  --group-id $EC2_SG_ID \
  --protocol tcp --port 3000 --cidr 10.0.0.0/16

aws ec2 authorize-security-group-ingress \
  --group-id $EC2_SG_ID \
  --protocol tcp --port 8000 --cidr 10.0.0.0/16

# 3. SG para RDS
aws ec2 create-security-group \
  --group-name acme-rds-sg \
  --description "Security group for ACME ERP RDS" \
  --vpc-id vpc-xxxxx

RDS_SG_ID=$(aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=acme-rds-sg" \
  --query 'SecurityGroups[0].GroupId' --output text)

# Inbound: PostgreSQL solo desde EC2
aws ec2 authorize-security-group-ingress \
  --group-id $RDS_SG_ID \
  --protocol tcp --port 5432 \
  --source-group $EC2_SG_ID
```

---

## 🗄️ PASO 3: CREAR RDS POSTGRESQL

```bash
# Crear subnet group para RDS
aws rds create-db-subnet-group \
  --db-subnet-group-name acme-rds-subnet-group \
  --db-subnet-group-description "Subnet group for ACME ERP RDS" \
  --subnet-ids subnet-xxxxx subnet-yyyyy

# Crear instancia RDS
aws rds create-db-instance \
  --db-instance-identifier acme-erp-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 16.3 \
  --master-username postgres \
  --master-user-password "SecurePassword123!" \
  --db-name acme_erp \
  --allocated-storage 100 \
  --storage-type gp3 \
  --vpc-security-group-ids $RDS_SG_ID \
  --db-subnet-group-name acme-rds-subnet-group \
  --publicly-accessible false \
  --multi-az true \
  --backup-retention-period 7 \
  --backup-window "03:00-04:00" \
  --maintenance-window "sun:04:00-sun:05:00" \
  --enable-cloudwatch-logs-exports postgresql \
  --enable-iam-database-authentication

# Obtener endpoint
RDS_ENDPOINT=$(aws rds describe-db-instances \
  --db-instance-identifier acme-erp-db \
  --query 'DBInstances[0].Endpoint.Address' --output text)

echo "RDS Endpoint: $RDS_ENDPOINT"
```

---

## 🖥️ PASO 4: LANZAR INSTANCIA EC2

```bash
# 1. Crear o importar clave SSH
aws ec2 create-key-pair \
  --key-name acme-erp-key \
  --query 'KeyMaterial' --output text > ~/.ssh/acme-erp-key.pem

chmod 400 ~/.ssh/acme-erp-key.pem

# 2. Crear instancia EC2 con script de inicialización
cat > user-data.sh << 'EOF'
#!/bin/bash
set -e

# Actualizar paquetes
apt-get update
apt-get upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
usermod -aG docker ubuntu

# Instalar Docker Compose
apt-get install -y docker-compose

# Instalar AWS CLI
apt-get install -y awscli

# Clonar repositorio
cd /home/ubuntu
git clone https://github.com/your-username/acme-erp.git
cd acme-erp

# Crear .env desde template
cp .env.example .env

# Editar variables de ambiente
sed -i "s|your-secret-key-change-this-in-production|$(openssl rand -base64 32)|g" .env
sed -i "s|your-secure-password|SecurePassword123!|g" .env
sed -i "s|your-aws-key|$AWS_ACCESS_KEY_ID|g" .env
sed -i "s|your-aws-secret|$AWS_SECRET_ACCESS_KEY|g" .env
sed -i "s|your-rds-endpoint|${RDS_ENDPOINT}|g" .env
sed -i "s|your-domain.com|${DOMAIN_NAME}|g" .env

# Iniciar servicios
docker-compose up -d

# Crear superusuario
docker-compose exec -T backend python manage.py createsuperuser --noinput \
  --username admin \
  --email admin@acmeerp.com

# Health check
docker-compose ps
EOF

chmod +x user-data.sh

# 3. Lanzar instancia
INSTANCE_ID=$(aws ec2 run-instances \
  --image-id ami-0c55b159cbfafe1f0 \ # Ubuntu 22.04 LTS en us-east-1
  --instance-type t3.medium \
  --key-name acme-erp-key \
  --security-group-ids $EC2_SG_ID \
  --subnet-id subnet-xxxxx \
  --associate-public-ip-address \
  --user-data file://user-data.sh \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=acme-erp-server}]' \
  --query 'Instances[0].InstanceId' --output text)

echo "Instancia creada: $INSTANCE_ID"

# Esperar a que esté running
aws ec2 wait instance-running --instance-ids $INSTANCE_ID

# Obtener IP pública
PUBLIC_IP=$(aws ec2 describe-instances \
  --instance-ids $INSTANCE_ID \
  --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)

echo "IP Pública: $PUBLIC_IP"
echo "Acceso SSH: ssh -i ~/.ssh/acme-erp-key.pem ubuntu@$PUBLIC_IP"
```

---

## 📦 PASO 5: CONFIGURAR BACKEND EN EC2

```bash
# SSH a la instancia
ssh -i ~/.ssh/acme-erp-key.pem ubuntu@$PUBLIC_IP

# En la instancia EC2:
cd acme-erp

# Verificar logs de Docker
docker-compose logs -f backend

# Ejecutar migraciones
docker-compose exec backend python manage.py migrate

# Crear usuario de prueba
docker-compose exec backend python manage.py shell << 'PYEOF'
from authentication.models import ACMEUser
ACMEUser.objects.create_user(
    username='testuser',
    email='test@acmeerp.com',
    password='TestPass123',
    mfa_enabled=False
)
print("✓ Usuario de prueba creado")
PYEOF

# Crear superusuario
docker-compose exec backend python manage.py createsuperuser
```

---

## 📊 PASO 6: CONFIGURAR S3 PARA BACKUPS

```bash
# Crear bucket S3
aws s3api create-bucket \
  --bucket acme-erp-backups-$(date +%s) \
  --region us-east-1

# Versioning
aws s3api put-bucket-versioning \
  --bucket acme-erp-backups \
  --versioning-configuration Status=Enabled

# Server-side encryption
aws s3api put-bucket-encryption \
  --bucket acme-erp-backups \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'

# Lifecycle policy (borrar backups antiguos después de 30 días)
aws s3api put-bucket-lifecycle-configuration \
  --bucket acme-erp-backups \
  --lifecycle-configuration '{
    "Rules": [{
      "Id": "DeleteOldBackups",
      "Status": "Enabled",
      "Expiration": {"Days": 30}
    }]
  }'

# Script de backup cron en EC2
cat > backup-db.sh << 'EOF'
#!/bin/bash
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="acme_erp_backup_${BACKUP_DATE}.sql"

# Hacer dump de la BD
pg_dump -h $RDS_ENDPOINT -U postgres acme_erp > "/tmp/${BACKUP_FILE}"

# Subir a S3
aws s3 cp "/tmp/${BACKUP_FILE}" s3://acme-erp-backups/

# Limpiar local
rm "/tmp/${BACKUP_FILE}"

echo "Backup completado: ${BACKUP_FILE}"
EOF

chmod +x backup-db.sh

# Agregar a crontab (backup diario a las 3 AM)
(crontab -l 2>/dev/null; echo "0 3 * * * /home/ubuntu/backup-db.sh") | crontab -
```

---

## 📈 PASO 7: CONFIGURAR CLOUDWATCH

```bash
# Crear log group
aws logs create-log-group --log-group-name /aws/acme-erp/django

aws logs create-log-group --log-group-name /aws/acme-erp/nginx

# Crear alarmas
aws cloudwatch put-metric-alarm \
  --alarm-name acme-erp-cpu-high \
  --alarm-description "Alerta si CPU > 80%" \
  --metric-name CPUUtilization \
  --namespace AWS/EC2 \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2

aws cloudwatch put-metric-alarm \
  --alarm-name acme-erp-database-connections \
  --alarm-description "Alerta si conexiones BD > 100" \
  --metric-name DatabaseConnections \
  --namespace AWS/RDS \
  --statistic Average \
  --period 300 \
  --threshold 100 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2
```

---

## 🔐 PASO 8: CONFIGURAR HTTPS CON ACM

```bash
# Solicitar certificado SSL
aws acm request-certificate \
  --domain-name your-domain.com \
  --subject-alternative-names www.your-domain.com \
  --validation-method DNS \
  --region us-east-1

# Obtener el ARN del certificado
CERT_ARN=$(aws acm list-certificates \
  --query "CertificateSummaryList[0].CertificateArn" --output text)

# En nginx.conf, actualizar para usar certificados ACM
# (Requiere configuración de ALB o CloudFront)
```

---

## 🚀 PASO 9: CREAR APPLICATION LOAD BALANCER

```bash
# Crear ALB
ALB_ARN=$(aws elbv2 create-load-balancer \
  --name acme-erp-alb \
  --subnets subnet-xxxxx subnet-yyyyy \
  --security-groups $ALB_SG_ID \
  --scheme internet-facing \
  --type application \
  --ip-address-type ipv4 \
  --query 'LoadBalancers[0].LoadBalancerArn' --output text)

# Crear target group
TG_ARN=$(aws elbv2 create-target-group \
  --name acme-erp-tg \
  --protocol HTTP \
  --port 80 \
  --vpc-id vpc-xxxxx \
  --health-check-protocol HTTP \
  --health-check-path /health \
  --health-check-interval-seconds 30 \
  --health-check-timeout-seconds 5 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 2 \
  --query 'TargetGroups[0].TargetGroupArn' --output text)

# Registrar EC2 como target
aws elbv2 register-targets \
  --target-group-arn $TG_ARN \
  --targets Id=$INSTANCE_ID

# Crear listener HTTP
aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTP \
  --port 80 \
  --default-actions Type=forward,TargetGroupArn=$TG_ARN
```

---

## 🔍 PASO 10: VERIFICAR DESPLIEGUE

```bash
# SSH a instancia
ssh -i ~/.ssh/acme-erp-key.pem ubuntu@$PUBLIC_IP

# Verificar servicios
docker-compose ps

# Ver logs
docker-compose logs backend
docker-compose logs frontend
docker-compose logs nginx

# Probar API
curl -s http://localhost:8000/api/auth/profile/ | jq .

# Probar frontend
curl -s http://localhost:3000/login | head -20

# Verificar conexión a BD
docker-compose exec backend python manage.py dbshell
```

---

## 📋 CHECKLIST DE DEPLOYMENT

- [ ] VPC creada (10.0.0.0/16)
- [ ] Subnets configuradas (Pública 10.0.1.0/24, Privada 10.0.2.0/24)
- [ ] Security Groups configurados (ALB, EC2, RDS)
- [ ] RDS PostgreSQL running (Multi-AZ)
- [ ] EC2 instance running
- [ ] Docker containers up and healthy
- [ ] Migraciones de BD ejecutadas
- [ ] Superusuario creado
- [ ] S3 bucket configurado para backups
- [ ] CloudWatch logs y alarmas activadas
- [ ] ALB creado y verificado
- [ ] SSL certificado (opcional)
- [ ] DNS configurado (opcional)

---

## 🛡️ CONSIDERACIONES DE SEGURIDAD

1. **Contraseñas:** Usar AWS Secrets Manager
2. **IAM:** Roles con permisos mínimos (least privilege)
3. **Logs:** Centralizar en CloudWatch y exportar a S3
4. **Backups:** Automatizados, cifrados y replicados
5. **Network:** NAT Gateway para outbound desde subnet privada
6. **SSL/TLS:** Obligatorio en producción
7. **DDoS:** Habilitar AWS Shield
8. **WAF:** AWS Web Application Firewall para ALB

---

## 💰 ESTIMACIÓN DE COSTOS (Mensuales)

- **EC2** (t3.medium): ~$30
- **RDS** (db.t3.micro): ~$25
- **ALB**: ~$16
- **Data Transfer**: ~$10
- **S3 Storage**: ~$5
- **CloudWatch**: ~$5
- **Total estimado**: **~$90/mes**

---

## 📞 SOPORTE Y TROUBLESHOOTING

Ver: [TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md)

---

**Última actualización:** June 13, 2026
**Versión:** 1.0
